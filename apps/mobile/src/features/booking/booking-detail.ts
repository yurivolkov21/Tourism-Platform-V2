import { ORPCError } from '@orpc/client';
import { ACTIVE_BOOKING_STATUSES, type BookingDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';

/**
 * Logic thuần của chi tiết booking (T4/T5/T8, W4) + huỷ (T6/T7, W5) — mockup
 * `mobile-booking-screens.src.html`. Port khuôn quyết định từ
 * `apps/web/src/lib/booking-vm.ts` (`bookingView`) nhưng gọn hơn: mobile không
 * cần `tone` riêng (pill trạng thái đã có `tripPillTone` ở `trips-list.ts`).
 */

export type BookingDetailKind =
  | 'pending'
  | 'paid'
  | 'cancelled'
  | 'refunded'
  | 'departureCancelled';

/**
 * Đơn đã từng thu tiền của khách: có `paidAt`, HOẶC sổ đã có khoản hoàn — cùng luật `wasCharged`
 * của web. `paidAt` một mình không đủ: đơn bị thu rồi hoàn tự động trước khi kịp sang PAID (thua
 * đua ghế, chuyến đóng lúc capture về) bị API đặt CANCELLED mà không ghi `paid_at`.
 */
function wasCharged(booking: Pick<BookingDetail, 'paidAt' | 'refundedTotal'>): boolean {
  return booking.paidAt !== null || Number(booking.refundedTotal) > 0;
}

/**
 * Đơn đóng vì CÔNG TY huỷ chuyến (ADR-0041 AMEND 1) — cùng luật `cancelledByOperator` của web.
 * Cờ `departureCancelled` một mình chưa đủ: lõi huỷ của công ty bỏ qua đơn đã đóng, nên đơn khách
 * tự huỷ TRƯỚC khi chuyến bị huỷ vẫn mang cờ. Công ty huỷ thì hoàn trọn phần còn lại, nên đơn
 * CANCELLED đã thu mà không hoàn đồng nào chỉ có thể là khách tự huỷ quá hạn: chuyện của khách.
 */
function cancelledByOperator(booking: BookingDetail): boolean {
  if (!booking.departureCancelled) return false;
  return !(
    booking.status === 'CANCELLED' &&
    wasCharged(booking) &&
    Number(booking.refundedTotal) <= 0
  );
}

/**
 * Năm khung màn chi tiết. `REFUNDED`/`PARTIALLY_REFUNDED` dùng chung khung T8
 * (mockup chỉ vẽ một bản — số tiền đã hoàn tự nói lên "một phần" hay "toàn
 * bộ"). `CANCELLED` tách theo tiền: khách tự huỷ đơn ĐÃ TRẢ thì API đặt
 * CANCELLED chứ không phải REFUNDED (ADR-0041 §4), nên đơn đã thu cũng về T8 để
 * kể khoản hoàn (hay câu không hoàn); khung `cancelled` chỉ còn cho đơn chưa
 * từng thu tiền (PENDING bị sweep/`cancelPending`) — không có gì để kể về tiền.
 * Chuyến bị CÔNG TY huỷ thắng mọi trạng thái đơn (ADR-0054 AMEND 1 §2): khung
 * `departureCancelled` nói "chúng tôi huỷ chuyến" như trang chi tiết đơn của
 * web, kể cả lúc job hoàn tiền chưa chạy và đơn còn PAID.
 */
export function bookingDetailKind(booking: BookingDetail): BookingDetailKind {
  if (cancelledByOperator(booking)) return 'departureCancelled';
  switch (booking.status) {
    case 'PENDING':
      return 'pending';
    case 'PAID':
      return 'paid';
    case 'CANCELLED':
      return wasCharged(booking) ? 'refunded' : 'cancelled';
    case 'REFUNDED':
    case 'PARTIALLY_REFUNDED':
      return 'refunded';
  }
}

/** Chuyện tiền của đơn trên chuyến công ty huỷ: tiền còn đang về, hay khoản sổ đã ghi. */
export type OperatorRefund =
  | { kind: 'onItsWay' }
  | { kind: 'refunded'; amount: string; refundedAt: string | null };

/**
 * Chuyện tiền của khung `departureCancelled`, cùng thứ tự `refundState` của web: đơn còn PAID hay
 * hoàn một phần là job hoàn tiền (`departure-refund`) chưa chạy — tiền đang về mà sổ chưa ghi
 * khoản hoàn của lần huỷ chuyến, nên đọc TRƯỚC sổ (đọc ngược là kể một khoản hoàn một phần cũ như
 * thể đã xong). Còn lại kể khoản sổ đã ghi, mốc như khung T8; đơn chưa từng thu tiền thì không có
 * gì để kể (`null`).
 */
export function operatorRefund(booking: BookingDetail): OperatorRefund | null {
  if (booking.departureCancelled && ACTIVE_BOOKING_STATUSES.includes(booking.status)) {
    return { kind: 'onItsWay' };
  }
  if (Number(booking.refundedTotal) <= 0) return null;
  return {
    kind: 'refunded',
    amount: booking.refundedTotal,
    refundedAt: booking.cancellationDecidedAt ?? booking.cancelledAt,
  };
}

export type BookingDetailAction = 'payNow' | 'cancelPending' | 'cancelBooking';

/**
 * Hành động khả dụng — CHỈ đọc cờ server (`cancellation.canCancel`), không tự
 * so ngày (ADR-0041 §7, cùng luật `bookingView` bên web). Quá hạn huỷ miễn phí
 * vẫn huỷ được (hoàn 0) nên `canCancel` KHÔNG đồng nghĩa `withinDeadline`.
 */
export function bookingDetailActions(booking: BookingDetail): BookingDetailAction[] {
  // Chuyến công ty huỷ: không còn gì để trả (đơn chờ trả bị huỷ cùng lệnh huỷ chuyến) hay để huỷ
  // (job hoàn tiền tự hoàn trọn phần còn lại).
  if (booking.departureCancelled) return [];
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

export type PayErrorAction = 'departureClosed' | 'refetch' | 'message';

/**
 * Lỗi khi bấm Pay ở T5 (`bookings.checkout`): đợt đã đóng → chỉ còn nút bỏ
 * booking; `NOT_PENDING` → booking đã đổi trạng thái ở nơi khác, đọc lại để
 * màn khớp sự thật; còn lại → hiện câu lỗi chung.
 */
export function payErrorAction(error: unknown): PayErrorAction {
  if (error instanceof ORPCError) {
    if (error.code === 'DEPARTURE_NOT_AVAILABLE') return 'departureClosed';
    if (error.code === 'NOT_PENDING') return 'refetch';
  }
  return 'message';
}
