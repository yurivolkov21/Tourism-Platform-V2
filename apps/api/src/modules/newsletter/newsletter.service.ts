import { Injectable } from '@nestjs/common';
import { prisma } from '../../auth/auth.config.js';
import { env } from '../../config/env.js';
import { EmailType } from '../../generated/prisma/enums.js';
import { makeUnsubscribeToken, verifyUnsubscribeToken } from './unsubscribe-token.js';

/**
 * Token sai định dạng, secret không khớp, hoặc `id` không ứng với subscriber
 * nào — controller map thẳng sang MỘT error code duy nhất
 * `INVALID_UNSUBSCRIBE_TOKEN` (spec §4.4), không phân biệt ba trường hợp này
 * ra ngoài để tránh biến response thành máy dò xem một subscriberId có tồn
 * tại hay không (cùng tinh thần chống-dò-email với `subscribe()`).
 */
export class InvalidUnsubscribeTokenError extends Error {}

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

      // Vá review Task 6 — Khoản 2: "chưa email nào chứa link huỷ đăng ký".
      // Sinh sẵn token NGAY LÚC enqueue (không để deliverer tự tính lại) —
      // giữ một nguồn sự thật duy nhất cho bí mật ký, và deliverer chỉ cần đọc
      // payload để ghép URL, không cần biết `NEWSLETTER_UNSUBSCRIBE_SECRET`.
      const unsubscribeToken = makeUnsubscribeToken(
        subscriber.id,
        env.NEWSLETTER_UNSUBSCRIBE_SECRET,
      );

      // dedupeKey theo EMAIL (không phải id) → "một lần vĩnh viễn cho mỗi địa
      // chỉ". Đây là ngoại lệ hợp lệ DUY NHẤT của quy ước dedupe-key (xem
      // docs/conventions/outbox-dedupe-key.md) — spec §4.4 ghi rõ: xoá
      // subscriber rồi đăng ký lại sẽ KHÔNG nhận welcome lần hai.
      // `skipDuplicates` ở đây LOAD-BEARING thật sự (key ổn định, khác hẳn
      // enquiry — key đó chứa uuid nên duy nhất theo cấu tạo).
      await tx.outbox.createMany({
        data: [
          {
            type: EmailType.NEWSLETTER_WELCOME,
            payload: { email: normalizedEmail, subscriberId: subscriber.id, unsubscribeToken },
            dedupeKey: `newsletter-welcome:${normalizedEmail}`,
          },
        ],
        skipDuplicates: true,
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
    if (!verifyUnsubscribeToken(id, token, env.NEWSLETTER_UNSUBSCRIBE_SECRET)) {
      throw new InvalidUnsubscribeTokenError();
    }
    const subscriber = await prisma.subscriber.findUnique({
      where: { id },
      select: { email: true, unsubscribedAt: true },
    });
    if (!subscriber) throw new InvalidUnsubscribeTokenError();
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
   */
  async unsubscribe(id: string, token: string): Promise<void> {
    if (!verifyUnsubscribeToken(id, token, env.NEWSLETTER_UNSUBSCRIBE_SECRET)) {
      throw new InvalidUnsubscribeTokenError();
    }
    const { count } = await prisma.subscriber.updateMany({
      where: { id, unsubscribedAt: null },
      data: { unsubscribedAt: new Date() },
    });
    if (count === 1) return;

    const exists = await prisma.subscriber.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new InvalidUnsubscribeTokenError();
    // exists nhưng count === 0 → đã unsubscribe từ trước, no-op idempotent.
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
  async resubscribe(id: string, token: string): Promise<void> {
    if (!verifyUnsubscribeToken(id, token, env.NEWSLETTER_UNSUBSCRIBE_SECRET)) {
      throw new InvalidUnsubscribeTokenError();
    }
    await prisma.subscriber.updateMany({
      where: { id, unsubscribedAt: { not: null } },
      data: { unsubscribedAt: null },
    });
  }
}
