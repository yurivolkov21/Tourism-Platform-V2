import {
  type AdminBookingDetail,
  type CancellationRequest,
  type CancellationRequestStatusValue,
  cancellationDeadline,
  fromCents,
  isWithinDeadline,
  type Refund,
  toCents,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { formatAmount, formatCalendarDate, formatDateTime } from './bookings-view';

/**
 * Mapper khối "Cancellation history" của `/bookings/[code]` (ADR-0041, spec §6)
 * — THUẦN, ngoài React, nên từng câu test được. Server component gọi nó.
 *
 * Không phép tính nào ở đây đọc đồng hồ (Q7): trong hay quá hạn chót xếp loại
 * trên mốc KHÁCH gửi yêu cầu bằng đúng hàm luật mà API và báo cáo tháng dùng,
 * nên ba nơi không thể nói ba câu khác nhau về cùng một lần huỷ.
 */

const t = messages.admin.bookings.detail.cancellations;

export type CancellationBadgeVariant = 'default' | 'secondary' | 'outline';

/** Phần yêu cầu mà một dòng lịch sử cần — `Pick` để fixture không kéo field thừa. */
export type CancellationHistoryRequest = Pick<
  CancellationRequest,
  'id' | 'status' | 'reason' | 'decisionNote' | 'decidedAt' | 'decidedByCustomer' | 'createdAt'
>;

/** Phần booking mà một dòng lịch sử cần: ngày đi, ngày về (hạn chót), đồng tiền, sổ hoàn. */
export type CancellationHistoryBooking = Pick<
  AdminBookingDetail,
  'departureStartDate' | 'departureEndDate' | 'currency' | 'refunds'
>;

/** Một dòng lịch sử đã định dạng sẵn. */
export interface CancellationHistoryRowVM {
  id: string;
  statusLabel: string;
  badgeVariant: CancellationBadgeVariant;
  /** Ai quyết; `null` khi yêu cầu (dữ liệu cũ) còn chưa ai quyết. */
  actor: string | null;
  requested: string;
  decided: string | null;
  /** Câu trong/quá hạn chót — chỉ dòng REFUNDED, tức lần huỷ thật. */
  deadline: string | null;
  /** Số tiền hoàn của CHÍNH lần huỷ — chỉ dòng REFUNDED. */
  refund: string | null;
  reason: string;
  decisionNote: string | null;
}

/**
 * Variant Badge — luật màu là DỮ LIỆU. REFUNDED nổi bật (booking đã huỷ),
 * REQUESTED nhạt (dữ liệu cũ đang chờ), DENIED viền trơn: từ chối là kết cục
 * BÌNH THƯỜNG của luồng cũ, tô destructive sẽ đọc thành "có lỗi". Chuyển từ
 * `cancellations-view.ts` khi vùng Cancellations bị gỡ.
 */
export function cancellationStatusBadgeVariant(
  status: CancellationRequestStatusValue,
): CancellationBadgeVariant {
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
 * Tiền hoàn của CHÍNH một lần huỷ: tổng các dòng sổ có `createdAt` nằm giữa lúc
 * gửi và lúc quyết của yêu cầu, tính cả hai đầu.
 *
 * Theo mốc chứ không theo cột nối vì sổ `refunds` không trỏ về yêu cầu nào. Lõi
 * huỷ ghi yêu cầu và dòng hoàn trong CÙNG một CTE (Hợp đồng C); luồng duyệt cũ
 * cũng ghi dòng hoàn đúng lúc quyết. Hoàn thiện chí trước hoặc sau lần huỷ nằm
 * ngoài khoảng ấy. Lấy min/max của hai mốc để không phụ thuộc bên nào ghi bằng
 * `now()` của SQL, bên nào bằng mốc JS. Cộng theo cent — không float.
 */
export function refundedForRequest(
  request: Pick<CancellationRequest, 'createdAt' | 'decidedAt'>,
  refunds: readonly Pick<Refund, 'amount' | 'createdAt'>[],
): string {
  if (request.decidedAt === null) return fromCents(0);
  const sent = Date.parse(request.createdAt);
  const decided = Date.parse(request.decidedAt);
  const from = Math.min(sent, decided);
  const to = Math.max(sent, decided);
  let cents = 0;
  for (const row of refunds) {
    const at = Date.parse(row.createdAt);
    if (at >= from && at <= to) cents += toCents(row.amount);
  }
  return fromCents(cents);
}

/** Ai quyết: `null` khi chưa ai quyết (yêu cầu REQUESTED của luồng cũ). */
function actorLabel(request: CancellationHistoryRequest): string | null {
  if (request.decidedAt === null) return null;
  return request.decidedByCustomer ? t.byCustomer : t.byStaff;
}

/** Yêu cầu của contract + booking → một dòng lịch sử đã định dạng (server component gọi). */
export function toCancellationHistoryRow(
  request: CancellationHistoryRequest,
  booking: CancellationHistoryBooking,
): CancellationHistoryRowVM {
  let deadline: string | null = null;
  let refund: string | null = null;

  // Chỉ dòng REFUNDED là một lần huỷ thật; REQUESTED/DENIED cũ không huỷ gì
  // nên không có hạn chót hay số tiền nào để nói.
  if (request.status === 'REFUNDED') {
    const { departureStartDate: start, departureEndDate: end } = booking;
    const deadlineLabel = formatCalendarDate(cancellationDeadline(start, end));
    deadline = isWithinDeadline(new Date(request.createdAt), start, end)
      ? t.withinDeadline(deadlineLabel)
      : t.afterDeadline(deadlineLabel);

    const amount = refundedForRequest(request, booking.refunds);
    refund =
      toCents(amount) > 0 ? t.refunded(formatAmount(amount, booking.currency)) : t.notRefunded;
  }

  return {
    id: request.id,
    statusLabel: t.status[request.status],
    badgeVariant: cancellationStatusBadgeVariant(request.status),
    actor: actorLabel(request),
    requested: formatDateTime(request.createdAt),
    decided: request.decidedAt ? formatDateTime(request.decidedAt) : null,
    deadline,
    refund,
    reason: request.reason ?? t.noReason,
    decisionNote: request.decisionNote,
  };
}
