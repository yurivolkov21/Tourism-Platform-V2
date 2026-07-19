import { Injectable } from '@nestjs/common';
import { prisma } from '../../auth/auth.config.js';
import { EmailType } from '../../generated/prisma/enums.js';

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

    await prisma.subscriber.upsert({
      where: { email: normalizedEmail },
      create: { email: normalizedEmail, source: source ?? null },
      update: {},
    });

    // dedupeKey theo EMAIL (không phải id) → "một lần vĩnh viễn cho mỗi địa
    // chỉ". Đây là ngoại lệ hợp lệ DUY NHẤT của quy ước dedupe-key (xem
    // docs/conventions/outbox-dedupe-key.md) — spec §4.4 ghi rõ: xoá
    // subscriber rồi đăng ký lại sẽ KHÔNG nhận welcome lần hai.
    // `skipDuplicates` ở đây LOAD-BEARING thật sự (key ổn định, khác hẳn
    // enquiry — key đó chứa uuid nên duy nhất theo cấu tạo).
    await prisma.outbox.createMany({
      data: [
        {
          type: EmailType.NEWSLETTER_WELCOME,
          payload: { email: normalizedEmail },
          dedupeKey: `newsletter-welcome:${normalizedEmail}`,
        },
      ],
      skipDuplicates: true,
    });
  }
}
