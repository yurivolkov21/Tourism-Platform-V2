import { ORPCError } from '@orpc/client';
import type { BookingDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';

/**
 * Logic thuần của chi tiết booking (T4/T5/T8, W4) + huỷ (T6/T7, W5) — mockup
 * `mobile-booking-screens.src.html`. Port khuôn quyết định từ
 * `apps/web/src/lib/booking-vm.ts` (`bookingView`) nhưng gọn hơn: mobile không
 * cần `tone` riêng (pill trạng thái đã có `tripPillTone` ở `trips-list.ts`).
 */

export type BookingDetailKind = 'pending' | 'paid' | 'cancelled' | 'refunded';

/**
 * Bốn khung màn chi tiết. `REFUNDED`/`PARTIALLY_REFUNDED` dùng chung khung T8
 * (mockup chỉ vẽ một bản — số tiền đã hoàn tự nói lên "một phần" hay "toàn
 * bộ"). `CANCELLED` là nhánh RIÊNG: booking chưa từng thu tiền (PENDING bị
 * sweep/`cancelPending`), không có gì để kể về tiền — mockup không vẽ khung
 * này tên riêng nhưng T1 liệt nó vào "đã huỷ/hoàn" nên vẫn cần một màn.
 */
export function bookingDetailKind(booking: BookingDetail): BookingDetailKind {
  switch (booking.status) {
    case 'PENDING':
      return 'pending';
    case 'PAID':
      return 'paid';
    case 'CANCELLED':
      return 'cancelled';
    case 'REFUNDED':
    case 'PARTIALLY_REFUNDED':
      return 'refunded';
  }
}

export type BookingDetailAction = 'payNow' | 'cancelPending' | 'cancelBooking';

/**
 * Hành động khả dụng — CHỈ đọc cờ server (`cancellation.canCancel`), không tự
 * so ngày (ADR-0041 §7, cùng luật `bookingView` bên web). Quá hạn huỷ miễn phí
 * vẫn huỷ được (hoàn 0) nên `canCancel` KHÔNG đồng nghĩa `withinDeadline`.
 */
export function bookingDetailActions(booking: BookingDetail): BookingDetailAction[] {
  switch (booking.status) {
    case 'PENDING':
      return ['payNow', 'cancelPending'];
    case 'PAID':
    case 'PARTIALLY_REFUNDED':
      return booking.cancellation?.canCancel ? ['cancelBooking'] : [];
    case 'CANCELLED':
    case 'REFUNDED':
      return [];
  }
}

/** Kết quả gắn với hành động vừa lỗi — có cần đọc lại booking không. */
export type CancelErrorAction = 'refetch' | 'stay';

/**
 * `NOT_CANCELLABLE`/`REFUND_AMOUNT_CHANGED` nghĩa là màn đang cầm dữ liệu cũ
 * (hạn trôi qua giữa chừng, admin vừa hoàn) — phải đọc lại để nút và số tiền
 * khớp sự thật (khuôn `performAction` bên web). Các lỗi khác KHÔNG đổi gì ở
 * server nên không cần đọc lại.
 */
export function cancelErrorAction(error: unknown): CancelErrorAction {
  if (error instanceof ORPCError) {
    if (error.code === 'NOT_CANCELLABLE' || error.code === 'REFUND_AMOUNT_CHANGED') {
      return 'refetch';
    }
  }
  return 'stay';
}

/**
 * Câu lỗi khi `bookings.cancel`/`cancelPending` thất bại — ĐỌC CHUNG
 * `messages.accountActionErrors` với web (handoff §5: "câu lỗi của
 * bookings.create và cancel dùng chung với web").
 */
export function cancelErrorCopy(error: unknown): string {
  const e = messages.accountActionErrors;
  if (error instanceof ORPCError) {
    if (error.status === 401) return e.sessionExpired;
    if (error.status === 429) return e.throttle;
    if (error.code === 'REFUND_FAILED') return e.refundFailed;
    if (error.code === 'REFUND_AMOUNT_CHANGED') return e.refundChanged;
    if (error.code === 'NOT_CANCELLABLE') return e.notCancellable;
    if (error.code === 'DEPARTURE_NOT_AVAILABLE') return e.bookingClosed;
  }
  return e.generic;
}
