import { Injectable } from '@nestjs/common';
import { prisma } from '../../auth/auth.config.js';
import { env } from '../../config/env.js';
import { EmailType } from '../../generated/prisma/enums.js';
import { isMailableSubscriber } from './mailable.js';
import { claimUnsubscribe } from './unsubscribe-claim.js';
import {
  consentGeneration,
  makeNewsletterToken,
  verifyNewsletterToken,
} from './unsubscribe-token.js';

/**
 * Thư xác nhận được gửi LẠI khi khách điền lại form mà vẫn chưa xác nhận và
 * lần gửi trước đã hơn 24 giờ (vòng vá review W4): `welcomeSentAt` set lúc
 * enqueue chứ không phải lúc giao, nên một thư FAILED/SKIPPED mà chặn tuyệt
 * đối là khách kẹt `confirmedAt` null vĩnh viễn. 24 giờ + dedupeKey theo
 * ngày = tối đa một thư xác nhận mỗi địa chỉ mỗi ngày, form footer không
 * thành máy gửi thư tới địa chỉ người lạ.
 */
export const CONFIRM_RESEND_AFTER_MS = 24 * 3_600_000;

/**
 * Token sai định dạng, secret không khớp, hoặc `id` không ứng với subscriber
 * nào — controller map thẳng sang MỘT error code duy nhất
 * `INVALID_UNSUBSCRIBE_TOKEN` (spec §4.4), không phân biệt ba trường hợp này
 * ra ngoài để tránh biến response thành máy dò xem một subscriberId có tồn
 * tại hay không (cùng tinh thần chống-dò-email với `subscribe()`).
 */
export class InvalidUnsubscribeTokenError extends Error {}

/** Token confirm sai/khác mục đích/id không tồn tại — một mã lỗi duy nhất
 * `INVALID_CONFIRM_TOKEN`, cùng tinh thần chống-dò với unsubscribe ở trên. */
export class InvalidConfirmTokenError extends Error {}

@Injectable()
export class NewsletterService {
  /**
   * Upsert im lặng: đăng ký lại KHÔNG báo lỗi, KHÔNG đổi response — chống dò
   * email (xem comment ở `SubscribeResultSchema`, contract). `update: {}`:
   * đã có thì để yên, KHÔNG reset `unsubscribedAt` ở đây (unsubscribe là
   * quyết định của chính người dùng, subscribe lại không tự ý đảo ngược nó —
   * nó chỉ gửi LẠI thư xác nhận với token thế hệ mới, và chính chủ hộp thư
   * bấm confirm mới là lúc consent được mở lại; xem `confirmSubscription`).
   */
  async subscribe(email: string, source?: string): Promise<void> {
    // Chuẩn hoá email TẠI BIÊN service — bắt buộc vì hai cột liên quan có
    // ngữ nghĩa case khác nhau: `Subscriber.email` là `@db.Citext` nên DB tự
    // coi `Jane@X.com` và `jane@x.com` là MỘT hàng, nhưng `Outbox.dedupeKey`
    // là `@db.VarChar(200)` THƯỜNG — phân biệt hoa/thường. Nếu ghép
    // `dedupeKey` từ `email` thô, hai lần subscribe cùng địa chỉ nhưng khác
    // hoa/thường sinh ra hai chuỗi dedupeKey khác nhau → `skipDuplicates`
    // không chặn được → hai email NEWSLETTER_WELCOME cho cùng một hộp thư,
    // vi phạm spec §4.4 ("chỉ gửi MỘT LẦN trong đời địa chỉ đó"). Dùng
    // NGUYÊN bản `normalizedEmail` cho cả upsert, dedupeKey, lẫn
    // `payload.email` (worker lấy field này làm người nhận — gửi tới bản đã
    // chuẩn hoá vừa đúng vừa nhất quán với hàng subscriber thật sự tồn tại).
    const normalizedEmail = email.trim().toLowerCase();

    // MỘT transaction cho CẢ HAI lệnh ghi — cùng khuôn producer-nguyên-tử với
    // `EnquiriesService.create()` và đúng bất biến `OutboxService` tự ghi
    // trong JSDoc ("producer ghi row PENDING nguyên tử cùng state change").
    // Tách rời thì một cú crash giữa hai lệnh để lại subscriber KHÔNG BAO GIỜ
    // nhận welcome: `dedupeKey` khoá theo email là "một lần vĩnh viễn", nên
    // ngay cả khi họ điền lại form cũng không sinh được welcome mới (upsert
    // `update: {}` no-op) — hỏng vĩnh viễn, im lặng, chỉ với một người.
    await prisma.$transaction(async (tx) => {
      const subscriber = await tx.subscriber.upsert({
        where: { email: normalizedEmail },
        create: { email: normalizedEmail, source: source ?? null },
        update: {},
      });

      // Đã xác nhận và chưa huỷ → không có gì để gửi (chống dò: response
      // ngoài vẫn y hệt).
      if (isMailableSubscriber(subscriber)) return;

      // W4 E2 (ADR-0039): bằng chứng "đã gửi thư đầu" là `welcomeSentAt`
      // trên CHÍNH subscriber, không phải row outbox — outbox purge SENT
      // sau 30 ngày, nên dedupeKey một mình chỉ chặn lặp trong 30 ngày rồi
      // welcome quay lại mỗi tháng cho ai điền lại form. Vòng vá review W4:
      // không chặn TUYỆT ĐỐI nữa — quá CONFIRM_RESEND_AFTER_MS mà vẫn chưa
      // xác nhận (thư hỏng, vào spam, hoặc khách đã huỷ rồi tự điền lại) thì
      // gửi lại thư xác nhận, khoá theo ngày.
      const now = new Date();
      if (
        subscriber.welcomeSentAt !== null &&
        now.getTime() - subscriber.welcomeSentAt.getTime() < CONFIRM_RESEND_AFTER_MS
      ) {
        return;
      }

      // Vá review Task 6 — Khoản 2: "chưa email nào chứa link huỷ đăng ký".
      // Sinh sẵn token NGAY LÚC enqueue (không để deliverer tự tính lại) —
      // giữ một nguồn sự thật duy nhất cho bí mật ký, và deliverer chỉ cần đọc
      // payload để ghép URL, không cần biết `NEWSLETTER_UNSUBSCRIBE_SECRET`.
      // W4 E4: token v1 mục đích `unsubscribe` — email mới không in HMAC
      // trần (thứ mở được mọi cửa) nữa; v0 chỉ còn được NHẬN, không SINH.
      const unsubscribeToken = makeNewsletterToken(
        subscriber.id,
        'unsubscribe',
        env.NEWSLETTER_UNSUBSCRIBE_SECRET,
      );

      // W4 E3 (ADR-0039 §2): thư đầu là thư XÁC NHẬN — payload mang
      // confirmToken (mục đích `confirm`, không hết hạn) để render-email
      // dựng CTA "Confirm subscription" thay vì welcome trần. Row Subscriber
      // chưa confirm là "đã xin", chưa phải "đã đồng ý". Token KHOÁ vào thế
      // hệ consent hiện tại (`consentGeneration`): khách huỷ là mọi thư xác
      // nhận cũ chết, thư gửi sau lần huỷ mới mở lại được.
      const confirmToken = makeNewsletterToken(
        subscriber.id,
        'confirm',
        env.NEWSLETTER_UNSUBSCRIBE_SECRET,
        now,
        consentGeneration(subscriber),
      );

      // dedupeKey: lần ĐẦU theo EMAIL (`newsletter-welcome:<email>`, "một lần
      // vĩnh viễn cho mỗi địa chỉ" — docs/conventions/outbox-dedupe-key.md);
      // gửi LẠI thì theo email + ngày UTC — tối đa một thư xác nhận mỗi ngày.
      // `skipDuplicates` là lưới thứ hai cho hai request đồng thời.
      const dedupeKey =
        subscriber.welcomeSentAt === null
          ? `newsletter-welcome:${normalizedEmail}`
          : `newsletter-confirm:${normalizedEmail}:${now.toISOString().slice(0, 10)}`;
      await tx.outbox.createMany({
        data: [
          {
            type: EmailType.NEWSLETTER_WELCOME,
            payload: {
              email: normalizedEmail,
              subscriberId: subscriber.id,
              unsubscribeToken,
              confirmToken,
            },
            dedupeKey,
          },
        ],
        skipDuplicates: true,
      });
      // CÙNG transaction với enqueue: outbox lỗi thì mốc này rollback theo —
      // không ai bị đánh dấu "đã gửi" mà thư thì không bao giờ được xếp hàng.
      await tx.subscriber.update({
        where: { id: subscriber.id },
        data: { welcomeSentAt: now },
      });
    });
  }

  /**
   * Dữ liệu cho trang xác nhận (GET) — thuần đọc, KHÔNG side effect. Xác
   * thực token trước (không cần round-trip DB — HMAC tự xác thực), rồi mới
   * tra subscriber. Cả hai nhánh thất bại (token sai / id không tồn tại) đều
   * ném CÙNG một lỗi để không lộ subscriberId nào có thật (chống dò).
   */
  async confirm(
    id: string,
    token: string,
  ): Promise<{ email: string; alreadyUnsubscribed: boolean }> {
    if (!verifyNewsletterToken(id, token, 'unsubscribe', env.NEWSLETTER_UNSUBSCRIBE_SECRET)) {
      throw new InvalidUnsubscribeTokenError();
    }
    const subscriber = await prisma.subscriber.findUnique({
      where: { id },
      select: { email: true, unsubscribedAt: true },
    });
    if (!subscriber) throw new InvalidUnsubscribeTokenError();
    // Cố ý KHÔNG mint token resubscribe ở đây (vòng vá review W4): GET này
    // mở bằng token unsubscribe KHÔNG hết hạn (nhận cả v0) — phát token
    // resubscribe từ nó là hạn 30 ngày và việc khoá v0 thành hư cấu, ai cầm
    // link huỷ cũ cũng bật lại consent được mãi. Token đó chỉ đi ra từ POST
    // huỷ VỪA thành công (`unsubscribe()`).
    return { email: subscriber.email, alreadyUnsubscribed: subscriber.unsubscribedAt !== null };
  }

  /**
   * Thực thi huỷ đăng ký (POST) — atomic claim theo đúng tinh thần ADR-0009:
   * MỘT statement `updateMany` với guard `unsubscribedAt: null` thay vì
   * đọc-rồi-ghi hai round-trip (tránh race hai POST đồng thời cùng lúc đều
   * đọc thấy `null` rồi cùng ghi, vô hại ở đây nhưng vẫn không phải cách
   * đúng). `count === 1` → vừa set xong. `count === 0` có HAI khả năng: đã
   * unsubscribe từ trước (idempotent — vẫn coi là thành công, KHÔNG đổi lại
   * `unsubscribedAt` để giữ đúng mốc thời gian khách thật sự rút consent) hoặc
   * `id` không tồn tại (lỗi) — phân biệt bằng một query tồn tại riêng.
   *
   * Trả `resubscribeToken` (mục đích `resubscribe`, hạn 30 ngày) CHỈ khi lệnh
   * này vừa claim được — nút "đổi ý" của panel ngay sau khi huỷ (vòng vá
   * review W4). Lần POST thứ hai (idempotent) KHÔNG phát lại: người cầm link
   * huỷ cũ không mint được quyền đăng ký lại vô hạn.
   */
  async unsubscribe(id: string, token: string): Promise<{ resubscribeToken?: string }> {
    if (!verifyNewsletterToken(id, token, 'unsubscribe', env.NEWSLETTER_UNSUBSCRIBE_SECRET)) {
      throw new InvalidUnsubscribeTokenError();
    }
    // Luật claim dùng chung với đường admin (`unsubscribe-claim.ts`, vòng vá
    // review F10); ở đây `already` là no-op idempotent — giữ đúng mốc khách
    // thật sự rút consent — còn `missing` là lỗi.
    const claim = await claimUnsubscribe(id);
    if (claim.kind === 'missing') throw new InvalidUnsubscribeTokenError();
    if (claim.kind !== 'claimed') return {};
    return {
      resubscribeToken: makeNewsletterToken(id, 'resubscribe', env.NEWSLETTER_UNSUBSCRIBE_SECRET),
    };
  }

  /**
   * Dữ liệu cho trang xác nhận đăng ký (GET /api/newsletter/confirm) — thuần
   * đọc, KHÔNG side effect (mail client prefetch link, cùng bài học với
   * `confirm()` của unsubscribe). Token mục đích `confirm` (W4 E3/E4), khoá
   * vào thế hệ consent của row (`consentGeneration`) nên phải ĐỌC row trước
   * rồi mới verify — id là uuid v7 không đoán được và tra theo PK, chấp nhận
   * lệch nếp "verify trước DB". `alreadyConfirmed` = còn mailable; row đã huỷ
   * thì token của thế hệ cũ đã chết nên rơi về lỗi token (link đó hết giá
   * trị — khách muốn quay lại thì điền lại form, thư mới mang thế hệ mới).
   */
  async confirmInfo(
    id: string,
    token: string,
  ): Promise<{ email: string; alreadyConfirmed: boolean }> {
    const subscriber = await this.subscriberForConfirm(id, token);
    return { email: subscriber.email, alreadyConfirmed: isMailableSubscriber(subscriber) };
  }

  /**
   * Thực thi xác nhận (POST) — compare-and-set đúng khuôn `claimUnsubscribe`:
   * MỘT `updateMany` với guard là CHÍNH trạng thái vừa đọc (`confirmedAt`,
   * `unsubscribedAt`), ghi `confirmedAt = now` và XOÁ `unsubscribedAt` (đây
   * là consent mới từ chủ hộp thư, mở lại row đã huỷ — token thế hệ mới mới
   * tới được đây). Bấm lần hai là no-op idempotent (giữ MỐC consent đầu —
   * đó là bằng chứng); `count === 0` do lượt khác vừa ghi cũng coi là đã
   * xong. Không bao giờ sinh row "đã xác nhận × đã huỷ" (`MAILABLE_SUBSCRIBER_WHERE`).
   */
  async confirmSubscription(id: string, token: string): Promise<void> {
    const subscriber = await this.subscriberForConfirm(id, token);
    if (isMailableSubscriber(subscriber)) return;
    await prisma.subscriber.updateMany({
      where: { id, confirmedAt: subscriber.confirmedAt, unsubscribedAt: subscriber.unsubscribedAt },
      data: { confirmedAt: new Date(), unsubscribedAt: null },
    });
  }

  /** Đọc row + verify token `confirm` theo thế hệ consent; cả hai nhánh hỏng ném CÙNG lỗi (chống dò). */
  private async subscriberForConfirm(
    id: string,
    token: string,
  ): Promise<{ email: string; confirmedAt: Date | null; unsubscribedAt: Date | null }> {
    const subscriber = await prisma.subscriber.findUnique({
      where: { id },
      select: { email: true, confirmedAt: true, unsubscribedAt: true },
    });
    if (
      !subscriber ||
      !verifyNewsletterToken(
        id,
        token,
        'confirm',
        env.NEWSLETTER_UNSUBSCRIBE_SECRET,
        new Date(),
        consentGeneration(subscriber),
      )
    ) {
      throw new InvalidConfirmTokenError();
    }
    return subscriber;
  }

  /**
   * Đăng ký lại NGAY sau khi huỷ (vá review Task 6 — Khoản 1, siết ở W4 E4 +
   * vòng vá review W4): cửa này CHỈ nhận token mục đích `resubscribe` — mint
   * duy nhất ở POST huỷ vừa thành công, hạn 30 ngày — nên nó là nút "đổi ý"
   * trong cửa sổ đó, không phải quyền vĩnh viễn của ai cầm link huỷ. Verify
   * TRƯỚC rồi mới chạm DB. `updateMany` guard `unsubscribedAt: { not: null }`
   * chỉ động tới row ĐANG huỷ; row vốn active để yên. Người huỷ trước W4 bị
   * migration bỏ `confirmedAt` (backfill cũ không loại họ) → mốc consent
   * được đặt lại ở đây nếu đang null: token này là bằng chứng chủ hộp thư
   * vừa huỷ rồi đổi ý trong 30 ngày.
   *
   * Cố ý KHÔNG phân biệt `count === 0` — output LUÔN `{subscribed:true}` một
   * khi token hợp lệ (JSDoc `ResubscribeResultSchema`): idempotent, không lộ
   * subscriber đang active hay vừa được reset.
   */
  async resubscribe(id: string, token: string): Promise<void> {
    if (!verifyNewsletterToken(id, token, 'resubscribe', env.NEWSLETTER_UNSUBSCRIBE_SECRET)) {
      throw new InvalidUnsubscribeTokenError();
    }
    await prisma.$transaction(async (tx) => {
      const { count } = await tx.subscriber.updateMany({
        where: { id, unsubscribedAt: { not: null } },
        data: { unsubscribedAt: null },
      });
      // Chỉ lượt THẬT SỰ mở lại mới đặt mốc consent; row vốn active (kể cả
      // chưa xác nhận) không bị đụng — updatedAt của họ giữ nguyên.
      if (count === 1) {
        await tx.subscriber.updateMany({
          where: { id, confirmedAt: null },
          data: { confirmedAt: new Date() },
        });
      }
    });
  }
}
