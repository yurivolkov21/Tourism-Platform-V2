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
    await prisma.subscriber.upsert({
      where: { email },
      create: { email, source: source ?? null },
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
          payload: { email },
          dedupeKey: `newsletter-welcome:${email}`,
        },
      ],
      skipDuplicates: true,
    });
  }
}
