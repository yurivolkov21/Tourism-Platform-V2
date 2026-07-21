import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { prisma } from './auth.config.js';

/**
 * Tombstone account deletion (spec §5, audit H5b) — flow CỦA TA, cố ý KHÔNG
 * dùng `auth.api.deleteUser` của Better Auth: BA hard-delete row user, trong
 * khi FK của Booking/Post/CancellationRequest… là `Restrict` — row user phải
 * sống mãi để lịch sử booking/refund giữ nguyên. Thay vào đó: scrub PII + xoá
 * session/account + flip cờ denormalized trên Review, tất cả trong MỘT
 * transaction.
 */
@Injectable()
export class AccountService {
  async deleteAccount(userId: string): Promise<void> {
    // Đọc email gốc TRƯỚC khi scrub — cần để dọn Subscriber trùng email (NL-R1).
    // TOCTOU không đáng lo: chỉ chính chủ xoá tài khoản mình, và email-change đang tắt.
    const { email } = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });
    // Email tombstone unique-per-delete → email gốc được GIẢI PHÓNG (citext
    // unique) cho người khác (hoặc chính chủ) đăng ký lại.
    const tombstoneEmail = `deleted+${randomUUID()}@tombstone.local`;

    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: {
          deletedAt: new Date(),
          name: null,
          phone: null,
          image: null,
          email: tombstoneEmail,
        },
      }),
      // Hard-delete credentials + phiên đăng nhập — mọi session cũ chết ngay.
      prisma.session.deleteMany({ where: { userId } }),
      prisma.account.deleteMany({ where: { userId } }),
      // Cờ denormalized cho sort/render public (audit M1) — web hiển thị
      // "Deleted account" mà không cần join users. Scrub LUÔN `authorName`
      // trong CÙNG update (spec §4.2, audit H5b) — bật cờ mà quên scrub thì
      // tên vẫn nằm trong DB. API hiện che được nhờ ternary ở mapper
      // (toPublicReview: authorDeleted ? null : authorName), nhưng đó là lỗ
      // xoá-dữ-liệu (GDPR erasure) thật ở tầng dữ liệu — một mapper tương lai
      // quên ternary là thành lỗ API thật ngay. `authorName` là NOT NULL nên
      // scrub về chuỗi rỗng, không phải null.
      prisma.review.updateMany({
        where: { userId },
        data: { authorDeleted: true, authorName: '' },
      }),
      // GDPR erasure (NL-R1): xoá HẲN Subscriber trùng email. Account deletion là
      // quyền-được-xoá — mạnh hơn soft-unsubscribe của flow công khai; để lại thì
      // vẫn gửi marketing tới email của user đã xoá VÀ giữ PII email trong DB.
      prisma.subscriber.deleteMany({ where: { email } }),
    ]);
  }
}
