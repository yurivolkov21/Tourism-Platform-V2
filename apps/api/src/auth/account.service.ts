import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { env } from '../config/env.js';
import { MediaType } from '../generated/prisma/enums.js';
import { buildCloudinaryUrl } from '../lib/cloudinary-url.js';
import { isOwnAvatarPublicId } from '../lib/upload-signing.js';
import { prisma } from './auth.config.js';

/** publicId không nằm trong folder avatar của CHÍNH user (ADR-0021 §3). */
export class AvatarPublicIdInvalidError extends Error {}

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
  /**
   * Ghi avatar qua đường ĐÓNG (ADR-0021 §3): server tự dựng URL delivery từ
   * publicId đã kiểm chủ quyền rồi mới chạm User.image — cố ý KHÔNG mở
   * updateUser.image từ client vì field đó nhận chuỗi bất kỳ.
   */
  async setAvatar(userId: string, publicId: string | null): Promise<string | null> {
    if (publicId === null) {
      await prisma.user.update({ where: { id: userId }, data: { image: null } });
      return null;
    }
    if (!isOwnAvatarPublicId(env.CLOUDINARY_UPLOAD_FOLDER, userId, publicId)) {
      throw new AvatarPublicIdInvalidError();
    }
    const { url } = buildCloudinaryUrl(env.CLOUDINARY_CLOUD_NAME, {
      type: MediaType.IMAGE,
      publicId,
    });
    await prisma.user.update({ where: { id: userId }, data: { image: url } });
    return url;
  }

  // ADR-0035 §4 liệt `setAvatar` là một nơi enqueue, nhưng thi công thì hoá ra
  // KHÔNG cần thêm gì ở đây, và lý do đáng ghi lại:
  //
  // Avatar cũ đã nằm sẵn trong hàng dọn từ lúc nó được KÝ (§3) — mọi publicId
  // đường ký cấp ra đều được ghi. Chừng nào nó còn là avatar hiện tại thì
  // `stillReferenced` thấy nó trong `users.image` và bỏ hàng; đổi avatar là
  // vế ấy hết đúng và tuần sau nó tự tới lượt.
  //
  // Thêm một lượt enqueue ở đây sẽ là `skipDuplicates` không làm gì (row đã
  // có), nhưng tệ hơn: nó dựng một đường thứ hai tới cùng một kết quả, để ai
  // đó sau này sửa một đường mà quên đường kia.

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
