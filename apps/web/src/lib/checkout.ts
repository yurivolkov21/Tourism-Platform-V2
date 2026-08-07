import type { Booking } from '@tourism/contract';

/**
 * Hạn sống của một booking PENDING, tính bằng phút kể từ `createdAt`.
 *
 * ⚠️ ĐÂY LÀ BẢN SAO của hằng số phía API — `PENDING_TTL_MINUTES` tại
 * `apps/api/src/worker/pending-sweep.service.ts:15`. Contract KHÔNG trả
 * `expiresAt`, nên web buộc phải tự tính; đổi bên kia thì phải đổi ở đây.
 *
 * Vì sao API chọn 65 chứ không phải một số tròn: nó phải LỚN HƠN hạn session
 * của mọi gateway (Stripe Checkout là 60 phút) — cron quét sớm hơn cổng thì có
 * thể huỷ một booking mà khách vẫn đang trả tiền. 65 = 60 + lề 5 phút.
 */
export const PENDING_TTL_MINUTES = 65;

/**
 * Ba tâm trạng của màn quay-về sau thanh toán.
 *
 * - `confirmed`  — tiền đã về, webhook đã xử lý xong.
 * - `confirming` — khách về trước webhook. Trạng thái TẠM, trang tự làm mới.
 * - `settled`    — booking đã ở một kết cục khác rồi (hết hạn giữa chừng, đã
 *                  huỷ, đã hoàn tiền). KHÔNG tự làm mới: không có gì để đợi.
 */
export type CheckoutMood = 'confirmed' | 'confirming' | 'settled';

export function checkoutMood(booking: Booking): CheckoutMood {
  if (booking.status === 'PAID') return 'confirmed';
  if (booking.status === 'PENDING') return 'confirming';
  return 'settled';
}

export interface PendingExpiry {
  /** Số phút còn lại, đã kẹp ở 0. */
  minutesLeft: number;
  expired: boolean;
}

/**
 * Còn bao lâu nữa booking PENDING này bị cron quét.
 *
 * Làm tròn XUỐNG có chủ ý: thà nói "còn 52 phút" khi thực tế còn 52 phút 20
 * giây, hơn là làm tròn lên thành 53 rồi khách quay lại đúng phút cuối và thấy
 * booking đã bị huỷ. Không bao giờ hứa nhiều hơn thực tế.
 *
 * `at` truyền vào được để test không phụ thuộc đồng hồ thật.
 */
export function pendingExpiry(createdAt: string, at: Date = new Date()): PendingExpiry {
  const deadline = new Date(createdAt).getTime() + PENDING_TTL_MINUTES * 60_000;
  const msLeft = deadline - at.getTime();
  if (msLeft <= 0) return { minutesLeft: 0, expired: true };
  return { minutesLeft: Math.floor(msLeft / 60_000), expired: false };
}
