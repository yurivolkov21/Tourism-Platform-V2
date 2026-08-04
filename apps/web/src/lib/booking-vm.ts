import type { Booking } from '@tourism/contract';

/**
 * Trạng thái yêu cầu hủy phía KHÁCH — type WEB TỰ KHAI, không lấy từ
 * `Booking`. Đối chiếu THẬT `libs/shared/contract/src/contract.ts`:
 * `bookings.byCode` (route khách gọi, owner-only) output `BookingSchema`
 * TRẦN — field `cancellationRequests` chỉ có ở `AdminBookingDetailSchema`
 * (`admin.bookings.byCode`, admin-only). Vì contract khách không mang field
 * này, mock cấp `CancellationView` riêng theo `bookingCode`
 * (`mocks/account.ts`) — đúng lựa chọn spec §9 dự phòng khi shape khách
 * không có sẵn.
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
