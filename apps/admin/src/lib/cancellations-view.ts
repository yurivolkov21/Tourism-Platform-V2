import type { AdminCancellationRequest, CancellationRequestStatusValue } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { formatCalendarDate, formatDateTime } from './bookings-view';

/**
 * Mapper hiển thị hàng đợi cancellation (spec P4b §3-F3) — THUẦN, nằm ngoài
 * React nên test được từng nhánh; bảng chỉ render VM có sẵn.
 *
 * Ngày giờ mượn thẳng hai hàm của `bookings-view` (tách chuỗi thay vì
 * `new Date()` cho ngày lịch, in UTC cho mốc ISO) — cùng một luật đọc thời
 * gian cho cả back-office, không chép bản thứ hai.
 */

const t = messages.admin.cancellations;

/** Nhãn trạng thái theo enum contract (dùng chung với lịch sử trang booking). */
export function cancellationStatusLabel(status: CancellationRequestStatusValue): string {
  return t.status[status];
}

/**
 * Variant Badge — luật màu là DỮ LIỆU, không rải trong JSX. REQUESTED nhạt
 * (đang chờ người quyết, cùng giọng với booking PENDING), REFUNDED nổi bật
 * (chuyện đã xong, tiền đã đi), DENIED viền trơn: từ chối là một kết cục
 * BÌNH THƯỜNG của quy trình, tô destructive sẽ đọc thành "có lỗi".
 */
export function cancellationStatusBadgeVariant(
  status: CancellationRequestStatusValue,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'REQUESTED':
      return 'secondary';
    case 'REFUNDED':
      return 'default';
    default:
      return 'outline';
  }
}

/**
 * Còn quyết được không? Chỉ REQUESTED — lịch sử append-only D1-B: một quyết
 * định là chung cuộc, khách muốn xét lại thì gửi request MỚI. Server cũng gác
 * đúng luật này (409 ALREADY_DECIDED), đây chỉ là cổng sớm phía UI.
 */
export function canDecide(status: CancellationRequestStatusValue): boolean {
  return status === 'REQUESTED';
}

/** Một hàng của bảng `/cancellations`. */
export interface CancellationRowVM {
  id: string;
  bookingCode: string;
  /** Link chéo sang chi tiết booking (§3-F3) — soi sổ cái ngay sau khi quyết. */
  bookingHref: string;
  tourTitle: string;
  departure: string;
  customerName: string;
  customerEmail: string;
  reason: string;
  status: CancellationRequestStatusValue;
  statusLabel: string;
  requested: string;
  /** `null` khi chưa quyết — bảng tự chọn hiện nút hay hiện dấu vết. */
  decided: string | null;
  decisionNote: string | null;
  pending: boolean;
}

/** Request của contract → hàng bảng đã format sẵn (server component gọi). */
export function toCancellationRow(request: AdminCancellationRequest): CancellationRowVM {
  return {
    id: request.id,
    bookingCode: request.bookingCode,
    bookingHref: `/bookings/${request.bookingCode}`,
    tourTitle: request.tourTitle,
    // Queue chỉ mang ngày BẮT ĐẦU đợt (contract không trả ngày kết thúc) —
    // in đúng thứ có thật thay vì bịa một khoảng.
    departure: formatCalendarDate(request.departureStartDate),
    customerName: request.contactName,
    customerEmail: request.contactEmail,
    reason: request.reason,
    status: request.status,
    statusLabel: cancellationStatusLabel(request.status),
    requested: formatDateTime(request.createdAt),
    decided: request.decidedAt ? formatDateTime(request.decidedAt) : null,
    decisionNote: request.decisionNote,
    pending: canDecide(request.status),
  };
}
