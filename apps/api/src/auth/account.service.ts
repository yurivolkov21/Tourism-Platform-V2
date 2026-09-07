import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { env } from '../config/env.js';
import {
  BookingStatus,
  CancellationRequestStatus,
  MediaOwnerType,
  MediaType,
} from '../generated/prisma/enums.js';
import { calendarDate, startOfDayUtc } from '../lib/calendar-date.js';
import { buildCloudinaryUrl } from '../lib/cloudinary-url.js';
import { anonymizeEnquiriesOfUser } from '../lib/enquiry-anonymize.js';
import { isOwnAvatarPublicId } from '../lib/upload-signing.js';
import { auth, prisma } from './auth.config.js';

/** publicId không nằm trong folder avatar của CHÍNH user (ADR-0021 §3). */
export class AvatarPublicIdInvalidError extends Error {}

// ── Lỗi domain của DELETE /api/account (ADR-0017 §7b) — controller map sang
// mã lỗi HTTP riêng để web nói được cho khách vì sao và làm gì tiếp. ──
/** Mật khẩu gửi lên không khớp credential Better Auth. */
export class AccountPasswordInvalidError extends Error {}
/** Tài khoản chỉ có OAuth (không row credential) — chưa có đường xoá self-service. */
export class AccountCredentialMissingError extends Error {}
/** Còn booking PAID chưa kết thúc chuyến, hoặc PARTIALLY_REFUNDED — tiền/dịch vụ còn treo. */
export class AccountHasPaidBookingsError extends Error {}
/** Còn booking PENDING với session thanh toán còn sống — tab cũ vẫn thu được tiền. */
export class AccountHasPendingCheckoutError extends Error {}
/** Còn cancellation request đang REQUESTED — đường hoàn tiền chạy dở. */
export class AccountHasOpenCancellationError extends Error {}
/** Sai mật khẩu quá nhiều lần trong cửa sổ khoá — chống dò bằng cookie trộm. */
export class AccountTooManyAttemptsError extends Error {}

/** Số lần sai mật khẩu ở DELETE trước khi khoá, và độ dài cửa sổ khoá. */
export const DELETE_MAX_ATTEMPTS = 5;
export const DELETE_LOCK_MS = 15 * 60_000;

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
  private readonly logger = new Logger(AccountService.name);

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

  /**
   * Lần thử mật khẩu SAI gần đây theo user (ADR-0017 §7b, vòng vá review W2):
   * DELETE nhận mật khẩu và trả 403 phân biệt nên với kẻ cầm cookie nó là một
   * oracle dò mật khẩu; trần ghi 20/60s = 28.800 lần/ngày im lặng. Khoá sau
   * `DELETE_MAX_ATTEMPTS` lần sai trong `DELETE_LOCK_MS` (per-process — cùng
   * ràng buộc numInstances 1 của throttle) và log WARN có userId để operator
   * thấy.
   */
  private readonly failedAttempts = new Map<string, { count: number; until: number }>();

  async deleteAccount(userId: string, password: string): Promise<void> {
    // Đọc email gốc TRƯỚC khi scrub — cần để dọn Subscriber trùng email (NL-R1).
    // TOCTOU không đáng lo: chỉ chính chủ xoá tài khoản mình, và email-change đang tắt.
    const { email } = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });

    // XÁC THỰC LẠI (ADR-0017 §7b): tombstone là bất khả hoàn tác — một cookie
    // (trộm được, tự gia hạn) không đủ; mật khẩu là bằng chứng SỞ HỮU. Verify
    // qua chính hash trong Account credential của Better Auth ($context.password
    // — cùng scrypt BA dùng lúc đăng nhập, không tự chế so sánh).
    const lock = this.failedAttempts.get(userId);
    if (lock && lock.count >= DELETE_MAX_ATTEMPTS && lock.until > Date.now()) {
      throw new AccountTooManyAttemptsError();
    }
    const credential = await prisma.account.findFirst({
      where: { userId, providerId: 'credential' },
      select: { password: true },
    });
    if (!credential?.password) throw new AccountCredentialMissingError();
    const ctx = await auth.$context;
    const valid = await ctx.password.verify({ hash: credential.password, password });
    if (!valid) {
      const next = {
        count: lock && lock.until > Date.now() ? lock.count + 1 : 1,
        until: Date.now() + DELETE_LOCK_MS,
      };
      this.failedAttempts.set(userId, next);
      this.logger.warn(
        `DELETE /api/account: wrong password for user ${userId} (attempt ${next.count}/${DELETE_MAX_ATTEMPTS})`,
      );
      throw new AccountPasswordInvalidError();
    }
    this.failedAttempts.delete(userId);

    // Email tombstone unique-per-delete → email gốc được GIẢI PHÓNG (citext
    // unique) cho người khác (hoặc chính chủ) đăng ký lại.
    const tombstoneEmail = `deleted+${randomUUID()}@tombstone.local`;
    const today = startOfDayUtc(calendarDate(new Date()));
    const now = new Date();

    // GATE nghiệp vụ TRONG cùng transaction với tombstone (ADR-0017 §7b, câu
    // gốc user duyệt — vòng vá review W2 trả lại sau khi bản thi công tự nới):
    // chặn khi còn tiền/nghĩa vụ treo. Đếm ngoài tx từng để hở khe cho webhook
    // capture chen giữa.
    await prisma.$transaction(async (tx) => {
      // (1) PAID mà chuyến CHƯA KẾT THÚC (theo endDate — chuyến đang chạy dở
      //     vẫn là dịch vụ đang giao), hoặc PARTIALLY_REFUNDED bất kể ngày
      //     (sổ còn phần dư phải hoàn — xoá là khách mất đường tự tra cứu).
      const paidOpen = await tx.booking.count({
        where: {
          userId,
          OR: [
            { status: BookingStatus.PAID, departureEndDate: { gte: today } },
            { status: BookingStatus.PARTIALLY_REFUNDED },
          ],
        },
      });
      if (paidOpen > 0) throw new AccountHasPaidBookingsError();
      // (2) PENDING còn session thanh toán SỐNG: tab Stripe cũ vẫn thu được
      //     tiền cho một chủ nhân đã tombstone → PAID không ai tự phục vụ được.
      //     Khách phải huỷ (cancelPending — có expireSession) trước.
      const pendingCheckout = await tx.booking.count({
        where: {
          userId,
          status: BookingStatus.PENDING,
          checkoutSessionExpiresAt: { gt: now },
        },
      });
      if (pendingCheckout > 0) throw new AccountHasPendingCheckoutError();
      // (3) cancellation request đang REQUESTED — đường hoàn tiền chạy dở.
      const openCancellations = await tx.cancellationRequest.count({
        where: { userId, status: CancellationRequestStatus.REQUESTED },
      });
      if (openCancellations > 0) throw new AccountHasOpenCancellationError();

      await tx.user.update({
        where: { id: userId },
        data: {
          deletedAt: now,
          name: null,
          phone: null,
          image: null,
          email: tombstoneEmail,
        },
      });
      // Hard-delete credentials + phiên đăng nhập — mọi session cũ chết ngay.
      await tx.session.deleteMany({ where: { userId } });
      await tx.account.deleteMany({ where: { userId } });
      // Cờ denormalized cho sort/render public (audit M1) — web hiển thị
      // "Deleted account" mà không cần join users. Scrub LUÔN `authorName`
      // trong CÙNG update (spec §4.2, audit H5b) — bật cờ mà quên scrub thì
      // tên vẫn nằm trong DB. `authorName` là NOT NULL nên scrub về chuỗi
      // rỗng, không phải null.
      await tx.review.updateMany({
        where: { userId },
        data: { authorDeleted: true, authorName: '' },
      });
      // Ảnh review của user đã xoá (ADR-0017 §7b, vòng vá review W2): PII
      // (mặt người, giấy tờ chụp nhầm) không được tiếp tục phục vụ công khai
      // chỉ vì tên đã bị che. Gỡ row `media_assets` → review hết ảnh ngay, và
      // đẩy vào hàng dọn Cloudinary (ADR-0035) — `stillReferenced` không còn
      // thấy nên ảnh gốc được xoá sau ân hạn. Ghi CÙNG tx (khuôn `requeue`).
      const reviewIds = (await tx.review.findMany({ where: { userId }, select: { id: true } })).map(
        (r) => r.id,
      );
      if (reviewIds.length > 0) {
        const assets = await tx.mediaAsset.findMany({
          where: { ownerType: MediaOwnerType.REVIEW, ownerId: { in: reviewIds } },
          select: { publicId: true },
        });
        if (assets.length > 0) {
          await tx.mediaAsset.deleteMany({
            where: { ownerType: MediaOwnerType.REVIEW, ownerId: { in: reviewIds } },
          });
          for (const { publicId } of assets) {
            await tx.mediaGarbage.upsert({
              where: { publicId },
              create: { publicId, resourceType: 'image', createdAt: now },
              update: { createdAt: now, attempts: 0, lastError: null },
            });
          }
        }
      }
      // W4 E8 (ADR-0039 §6): anonymize NGAY mọi enquiry user này gửi lúc
      // đang đăng nhập — quyền được xoá mạnh hơn lịch retention 18 tháng.
      // Cùng máy anonymize với job hằng ngày (một nguồn sự thật), chạy trong
      // CÙNG tx tombstone.
      await anonymizeEnquiriesOfUser(tx, userId);
      // GDPR erasure (NL-R1): xoá HẲN Subscriber trùng email. Account deletion là
      // quyền-được-xoá — mạnh hơn soft-unsubscribe của flow công khai; để lại thì
      // vẫn gửi marketing tới email của user đã xoá VÀ giữ PII email trong DB.
      await tx.subscriber.deleteMany({ where: { email } });
      // Verification treo (ADR-0017 §7b): reset token của BA lưu value=userId,
      // OTP lưu identifier `<type>-otp-<email>` — dọn CẢ HAI dạng trong cùng
      // tx, không thì link reset cũ tạo lại Account credential cho user đã
      // tombstone (và giữ PII email trong identifier).
      await tx.verification.deleteMany({
        where: { OR: [{ value: userId }, { identifier: { endsWith: `-otp-${email}` } }] },
      });
    });
  }
}
