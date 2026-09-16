import type { Booking, BookingCancellation } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { formatChipDate, formatDate } from './tours';

/** Tông màu badge — token-only (spec §3), map 1-1 theo nhóm status. */
export type BookingViewTone = 'success' | 'warning' | 'muted' | 'destructive';

/**
 * Hành động khả dụng trên trang chi tiết booking.
 *
 * `cancelBooking` thay bộ ba `requestCancellation`/`viewCancellationPending`/
 * `resubmitCancellation` của luồng khách xin huỷ, admin duyệt — luồng đó gỡ
 * theo ADR-0041 §4: khách huỷ là huỷ ngay, không còn trạng thái "đang chờ".
 */
export type BookingAction = 'payNow' | 'cancelPending' | 'cancelBooking';

/**
 * Kết quả bảng quyết định — component CHỈ render `BookingView`, KHÔNG
 * if/else theo status trong JSX ngoài map action→nút (plan Task 4 cụm cũ).
 */
export interface BookingView {
  tone: BookingViewTone;
  statusKey: string;
  actions: BookingAction[];
}

/**
 * Bảng quyết định status → (tone, hành động) — hàm THUẦN:
 *
 * - `PENDING` → warning + [payNow, cancelPending].
 * - `PAID` → success; `PARTIALLY_REFUNDED` → destructive. Cả hai có
 *   [cancelBooking] khi và chỉ khi SERVER nói `cancellation.canCancel`
 *   (spec §5.3) — kể cả khi đã quá hạn chót: huỷ vẫn được, chỉ là hoàn 0.
 * - `CANCELLED` → muted + [] (terminal).
 * - `REFUNDED` → destructive + [] — đã hoàn thiện chí toàn bộ thì không huỷ
 *   online, khách liên hệ (spec §3.3).
 *
 * Web KHÔNG tự so ngày để quyết có nút huỷ hay không (ADR-0041 §7): `cancellation`
 * là cờ `bookings.byCode` trả. Vắng cờ (danh sách `mine`, hộ chiếu) thì không
 * có nút huỷ, còn tone giữ nguyên nên `passport.ts` không bị ảnh hưởng.
 */
export function bookingView(
  b: Booking,
  cancellation: BookingCancellation | null = null,
): BookingView {
  const cancel: BookingAction[] = cancellation?.canCancel ? ['cancelBooking'] : [];
  switch (b.status) {
    case 'PENDING':
      return { tone: 'warning', statusKey: b.status, actions: ['payNow', 'cancelPending'] };
    case 'PAID':
      return { tone: 'success', statusKey: b.status, actions: cancel };
    case 'CANCELLED':
      return { tone: 'muted', statusKey: b.status, actions: [] };
    case 'REFUNDED':
      return { tone: 'destructive', statusKey: b.status, actions: [] };
    case 'PARTIALLY_REFUNDED':
      return { tone: 'destructive', statusKey: b.status, actions: cancel };
  }
}

/**
 * Câu hạn chót huỷ miễn phí cho trang booking và trang thanh toán thành công —
 * `null` khi server không gửi `cancellation` (booking không ở PAID hoặc
 * PARTIALLY_REFUNDED).
 *
 * Chỉ IN cờ `withinDeadline` và ngày `deadline` server tính: trang không so
 * ngày chót với giờ trình duyệt, nên chỉnh đồng hồ máy không đổi được câu này
 * (spec §2 Q7).
 */
export function cancellationDeadlineText(cancellation: BookingCancellation | null): string | null {
  if (cancellation === null) return null;
  const t = messages.cancellationDeadline;
  const date = formatChipDate(cancellation.deadline);
  return cancellation.withinDeadline ? t.full(date) : t.passed(date);
}

/**
 * Yêu cầu huỷ của luồng duyệt đã gỡ (REQUESTED, DENIED) còn nằm trên dữ liệu
 * trước lượt seed lại — in dạng chỉ đọc, chỉ kể lại sự việc (spec §5.3).
 * REFUNDED là kết cục thường của mọi lần huỷ nên không có dòng riêng.
 */
export function legacyCancellationNote(b: Booking): string | null {
  if (b.cancellationRequestedAt === null) return null;
  const t = messages.accountBookingDetail.legacyRequest;
  // Mốc ISO đầy đủ: cắt phần ngày trước khi đưa `formatDate` (hàm đó chỉ nhận
  // `YYYY-MM-DD`, cùng lý do ở dòng "Booked …" của trang chi tiết).
  const sentOn = formatDate(b.cancellationRequestedAt.slice(0, 10));
  if (b.cancellationStatus === 'REQUESTED') return t.requested(sentOn);
  if (b.cancellationStatus === 'DENIED') return t.denied(sentOn);
  return null;
}

/**
 * Chuyện gì đã xảy ra với TIỀN của khách — `null` khi không có gì để kể.
 *
 * Có mặt vì tới 04/09 trang chi tiết booking của khách không hề nói số tiền
 * đã hoàn: khách thấy đúng chữ "Cancelled" và không gì khác, còn bằng chứng
 * duy nhất nằm trong hộp mail.
 *
 * `none` (huỷ mà không hoàn đồng nào) CŨNG là một câu chuyện phải kể: im lặng
 * thì khách tự đoán rồi ngồi đợi một khoản không bao giờ tới.
 */
export type RefundSummary =
  | { kind: 'full'; amount: string }
  | { kind: 'partial'; amount: string; total: string }
  | { kind: 'none' };

/**
 * Booking chưa từng thu tiền thì KHÔNG kể gì: PENDING hết hạn hay khách tự
 * huỷ trước khi trả là "chưa bao giờ có giao dịch", không phải "hoàn 0 đồng".
 * Đó là lý do cổng đầu tiên là `paidAt`, không phải status.
 *
 * So sánh bằng `Number` chứ không bằng chuỗi: '0' và '0.00' là cùng một số
 * tiền, và cả hai đều xuất hiện thật (API trả '0.00', sổ rỗng trả '0').
 */
export function refundSummary(b: Booking): RefundSummary | null {
  if (b.paidAt === null) return null;
  const refunded = Number(b.refundedTotal);
  const total = Number(b.totalAmount);
  if (refunded <= 0) return b.status === 'CANCELLED' ? { kind: 'none' } : null;
  // `>=` chứ không `===`: sổ chốt trần ở total (trigger ADR-0009), nhưng một
  // ca làm tròn lẻ cent không được biến "đã hoàn đủ" thành "hoàn một phần".
  if (refunded >= total) return { kind: 'full', amount: b.refundedTotal };
  return { kind: 'partial', amount: b.refundedTotal, total: b.totalAmount };
}
