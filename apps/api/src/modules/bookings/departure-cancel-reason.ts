import { DepartureStatus } from '../../generated/prisma/enums.js';

/**
 * Lý do CÔNG TY huỷ chuyến cho chính khách đọc (ADR-0041 AMEND 2) — câu admin gõ ở hộp huỷ chuyến,
 * lưu ở `tour_departures.cancel_reason`.
 *
 * Chỉ trả khi chuyến đang `CANCELLED`: cột ấy chỉ được ghi lúc huỷ, nhưng một chuyến còn chạy
 * không có gì để giải thích. Chuyến huỷ không có sổ (seed lượt 1) hay lý do chỉ có khoảng trắng
 * trả `null`, để web và app không in một khối "Why" rỗng.
 */
export function departureCancelReason(departure: {
  status: DepartureStatus;
  cancelReason: string | null;
}): string | null {
  if (departure.status !== DepartureStatus.CANCELLED) return null;
  const reason = departure.cancelReason?.trim();
  return reason ? reason : null;
}
