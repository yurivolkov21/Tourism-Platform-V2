import { Injectable } from '@nestjs/common';
import { prisma } from '../../auth/auth.config.js';
import { env } from '../../config/env.js';
import { EmailType } from '../../generated/prisma/enums.js';
import { claimUnsubscribe } from './unsubscribe-claim.js';
import { makeNewsletterToken, verifyNewsletterToken } from './unsubscribe-token.js';

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
   * quyết định của chính người dùng, subscribe lại không tự ý đảo ngược nó).
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

      // W4 E2 (ADR-0039): bằng chứng "đã gửi thư đầu" là `welcomeSentAt`
      // trên CHÍNH subscriber, không phải row outbox — outbox purge SENT
      // sau 30 ngày, nên dedupeKey một mình chỉ chặn lặp trong 30 ngày rồi
      // welcome quay lại mỗi tháng cho ai điền lại form.
      if (subscriber.welcomeSentAt !== null) return;

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
      // chưa confirm là "đã xin", chưa phải "đã đồng ý".
      const confirmToken = makeNewsletterToken(
        subscriber.id,
        'confirm',
        env.NEWSLETTER_UNSUBSCRIBE_SECRET,
      );

      // dedupeKey theo EMAIL (không phải id) → "một lần vĩnh viễn cho mỗi địa
      // chỉ" (xem docs/conventions/outbox-dedupe-key.md); từ W4 nó là lưới
      // THỨ HAI sau `welcomeSentAt` — vẫn giữ `skipDuplicates` cho ca hai
      // request đồng thời cùng thấy welcomeSentAt null.
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
            dedupeKey: `newsletter-welcome:${normalizedEmail}`,
          },
        ],
        skipDuplicates: true,
      });
      // CÙNG transaction với enqueue: outbox lỗi thì mốc này rollback theo —
      // không ai bị đánh dấu "đã gửi" mà thư thì không bao giờ được xếp hàng.
      await tx.subscriber.update({
        where: { id: subscriber.id },
        data: { welcomeSentAt: new Date() },
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
  ): Promise<{ email: string; alreadyUnsubscribed: boolean; resubscribeToken: string }> {
    if (!verifyNewsletterToken(id, token, 'unsubscribe', env.NEWSLETTER_UNSUBSCRIBE_SECRET)) {
      throw new InvalidUnsubscribeTokenError();
    }
    const subscriber = await prisma.subscriber.findUnique({
      where: { id },
      select: { email: true, unsubscribedAt: true },
    });
    if (!subscriber) throw new InvalidUnsubscribeTokenError();
    return {
      email: subscriber.email,
      alreadyUnsubscribed: subscriber.unsubscribedAt !== null,
      // W4 E4: mint token resubscribe (hạn 30 ngày) cho nút "đăng ký lại"
      // của panel — token unsubscribe trong URL không mở được cửa đó nữa,
      // xem JSDoc `UnsubscribeConfirmResultSchema`.
      resubscribeToken: makeNewsletterToken(id, 'resubscribe', env.NEWSLETTER_UNSUBSCRIBE_SECRET),
    };
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
   */
  async unsubscribe(id: string, token: string): Promise<void> {
    if (!verifyNewsletterToken(id, token, 'unsubscribe', env.NEWSLETTER_UNSUBSCRIBE_SECRET)) {
      throw new InvalidUnsubscribeTokenError();
    }
    // Luật claim dùng chung với đường admin (`unsubscribe-claim.ts`, vòng vá
    // review F10); ở đây `already` là no-op idempotent — giữ đúng mốc khách
    // thật sự rút consent — còn `missing` là lỗi.
    const claim = await claimUnsubscribe(id);
    if (claim.kind === 'missing') throw new InvalidUnsubscribeTokenError();
  }

  /**
   * Vá review Task 6 — Khoản 1: đăng ký lại sau khi huỷ. Verify token TRƯỚC
   * rồi mới chạm DB — giữ đúng nếp của `unsubscribe()` (không dò được `id`
   * nào có thật từ response). Sau đó `updateMany` với guard
   * `unsubscribedAt: { not: null }`: chỉ động tới hàng ĐANG bị huỷ, subscriber
   * vốn đã active thì để yên (không đụng `updatedAt`/audit trail của họ một
   * cách vô cớ).
   *
   * Cố ý KHÔNG phân biệt `count === 0` do "id không tồn tại" hay "đã active
   * sẵn" như `unsubscribe()` — output LUÔN `{subscribed:true}` một khi token
   * hợp lệ (xem JSDoc `ResubscribeResultSchema`, contract): không tiết lộ
   * thêm thông tin nào ngoài "token này hợp lệ", đây chính là tính idempotent
   * được yêu cầu (gọi lại bao nhiêu lần cũng 200, không throw, không đổi
   * hành vi).
   */
  /**
   * Dữ liệu cho trang xác nhận đăng ký (GET /api/newsletter/confirm) — thuần
   * đọc, KHÔNG side effect (mail client prefetch link, cùng bài học với
   * `confirm()` của unsubscribe). Token mục đích `confirm` (W4 E3/E4).
   */
  async confirmInfo(
    id: string,
    token: string,
  ): Promise<{ email: string; alreadyConfirmed: boolean }> {
    if (!verifyNewsletterToken(id, token, 'confirm', env.NEWSLETTER_UNSUBSCRIBE_SECRET)) {
      throw new InvalidConfirmTokenError();
    }
    const subscriber = await prisma.subscriber.findUnique({
      where: { id },
      select: { email: true, confirmedAt: true },
    });
    if (!subscriber) throw new InvalidConfirmTokenError();
    return { email: subscriber.email, alreadyConfirmed: subscriber.confirmedAt !== null };
  }

  /**
   * Thực thi xác nhận (POST) — atomic claim đúng khuôn `claimUnsubscribe`:
   * MỘT `updateMany` với guard `confirmedAt: null`; bấm lần hai là no-op
   * idempotent (giữ nguyên MỐC consent đầu tiên — đó là bằng chứng), id
   * không tồn tại mới là lỗi.
   */
  async confirmSubscription(id: string, token: string): Promise<void> {
    if (!verifyNewsletterToken(id, token, 'confirm', env.NEWSLETTER_UNSUBSCRIBE_SECRET)) {
      throw new InvalidConfirmTokenError();
    }
    const { count } = await prisma.subscriber.updateMany({
      where: { id, confirmedAt: null },
      data: { confirmedAt: new Date() },
    });
    if (count === 1) return;
    const exists = await prisma.subscriber.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new InvalidConfirmTokenError();
  }

  async resubscribe(id: string, token: string): Promise<void> {
    // W4 E4: cửa này CHỈ nhận token mục đích `resubscribe` (mint ở
    // `confirm()`, hạn 30 ngày) — token unsubscribe trong email không đảo
    // ngược được consent, kể cả bản v0 cũ.
    if (!verifyNewsletterToken(id, token, 'resubscribe', env.NEWSLETTER_UNSUBSCRIBE_SECRET)) {
      throw new InvalidUnsubscribeTokenError();
    }
    await prisma.subscriber.updateMany({
      where: { id, unsubscribedAt: { not: null } },
      data: { unsubscribedAt: null },
    });
  }
}
