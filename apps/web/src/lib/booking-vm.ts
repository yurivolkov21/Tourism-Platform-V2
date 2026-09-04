import type { Booking } from '@tourism/contract';

/**
 * Trạng thái yêu cầu hủy phía KHÁCH — type WEB TỰ KHAI, KHÔNG trùng field
 * `Booking['cancellationStatus']` (Task 6a: `'REQUESTED'|'REFUNDED'|'DENIED'|
 * null`). Dựng từ field đó qua `toCancellationView` bên dưới (Task 6, A2) —
 * `decisionNote` LUÔN `null` khi dựng từ API thật: đối chiếu
 * `libs/shared/contract/src/contract.ts`, `bookings.byCode` (route khách gọi,
 * owner-only) output `BookingSchema` TRẦN, không mang lý do admin từ chối —
 * field đó (`cancellationRequests[].decisionNote`) chỉ có ở
 * `AdminBookingDetailSchema` (`admin.bookings.byCode`, admin-only). `null`
 * vẫn hiển thị đúng — `BookingActions` đã bọc nhánh `deniedNote ? … : null`.
 *
 * `REFUNDED` không xuất hiện ở đây: approve-cancellation chuyển `Booking`
 * sang `CANCELLED` ngay (docs/conventions/booking-states.md) nên một booking
 * còn đang `PAID` chỉ mang cancellation chưa-có/`REQUESTED`/`DENIED`.
 */
export interface CancellationView {
  status: 'REQUESTED' | 'DENIED';
  decisionNote: string | null;
}

/** Tông màu badge — token-only (spec §3), map 1-1 theo nhóm status. */
export type BookingViewTone = 'success' | 'warning' | 'muted' | 'destructive';

/** Hành động khả dụng trên trang chi tiết booking (spec §3). */
export type BookingAction =
  | 'payNow'
  | 'cancelPending'
  | 'requestCancellation'
  | 'viewCancellationPending'
  | 'resubmitCancellation';

/**
 * Kết quả bảng quyết định — component CHỈ render `BookingView`, KHÔNG
 * if/else theo status trong JSX ngoài map action→nút (plan Task 4).
 */
export interface BookingView {
  tone: BookingViewTone;
  statusKey: string;
  actions: BookingAction[];
}

/**
 * Bảng quyết định status → (tone, hành động) — hàm THUẦN (spec §3):
 *
 * - `PENDING` → warning + [payNow, cancelPending].
 * - `PAID` → success + đúng MỘT action cancellation, chọn theo
 *   `cancellation`: chưa có → requestCancellation · REQUESTED →
 *   viewCancellationPending · DENIED → resubmitCancellation.
 * - `CANCELLED` → muted + [] (terminal, không hành động gì thêm).
 * - `REFUNDED`/`PARTIALLY_REFUNDED` → destructive + [] (đọc số tiền đã hoàn
 *   từ ledger ở trang chi tiết, không phải từ VM này).
 *
 * `cancellation` chỉ có ý nghĩa khi `b.status === 'PAID'` — bị bỏ qua ở mọi
 * status khác vì máy trạng thái không cho phép cancellation request đang mở
 * trên booking không PAID (booking-states.md).
 */
/**
 * Task 6 (A2): map `Booking['cancellationStatus']` (đọc thẳng từ
 * `bookings.byCode` thật — Task 6a) sang `CancellationView` cho `bookingView`
 * bên dưới. `REFUNDED` map về `undefined` (KHÔNG map thẳng vào `CancellationView`
 * — kiểu đó cố ý chỉ có 'REQUESTED'|'DENIED', xem JSDoc trên) — theo
 * `docs/conventions/booking-states.md` một khi cancellation được duyệt thì
 * `Booking.status` đã chuyển `CANCELLED` ngay, nên một booking còn `PAID` không
 * bao giờ mang `cancellationStatus: 'REFUNDED'` thật; nhánh này chỉ là phòng thủ
 * (never null decisionNote vì contract khách không mang field đó — chỉ
 * `AdminBookingDetailSchema` admin-only mới có lịch sử `decisionNote`).
 */
export function toCancellationView(
  status: Booking['cancellationStatus'],
): CancellationView | undefined {
  if (status === 'REQUESTED' || status === 'DENIED') {
    return { status, decisionNote: null };
  }
  return undefined;
}

export function bookingView(b: Booking, cancellation?: CancellationView): BookingView {
  switch (b.status) {
    case 'PENDING':
      return { tone: 'warning', statusKey: b.status, actions: ['payNow', 'cancelPending'] };
    case 'PAID': {
      let action: BookingAction = 'requestCancellation';
      if (cancellation?.status === 'REQUESTED') action = 'viewCancellationPending';
      else if (cancellation?.status === 'DENIED') action = 'resubmitCancellation';
      return { tone: 'success', statusKey: b.status, actions: [action] };
    }
    case 'CANCELLED':
      return { tone: 'muted', statusKey: b.status, actions: [] };
    case 'REFUNDED':
    case 'PARTIALLY_REFUNDED':
      return { tone: 'destructive', statusKey: b.status, actions: [] };
  }
}

/**
 * Chuyện gì đã xảy ra với TIỀN của khách — `null` khi không có gì để kể.
 *
 * Có mặt vì tới 04/09 trang chi tiết booking của khách không hề nói số tiền
 * đã hoàn: sau một lần duyệt huỷ hoàn một phần, khách thấy đúng chữ
 * "Cancelled" và không gì khác, còn bằng chứng duy nhất nằm trong hộp mail.
 *
 * `none` (huỷ mà không hoàn đồng nào) CŨNG là một câu chuyện phải kể, cùng lý
 * do với mail duyệt huỷ: im lặng thì khách tự đoán rồi ngồi đợi một khoản
 * không bao giờ tới.
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
