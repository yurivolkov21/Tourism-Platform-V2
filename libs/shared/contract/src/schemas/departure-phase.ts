import { z } from 'zod';
import type { AdminDepartureStatus } from './admin-departures.js';
import { isWithinDeadline, vietnamToday } from './refund-policy.js';

/**
 * Giai đoạn của một chuyến khởi hành (ADR-0046, spec F16) — SUY từ công tắc
 * bán hàng (`status`) và hai ngày của chuyến, KHÔNG lưu ở đâu cả.
 *
 * Cột `status` chỉ là ý muốn của người vận hành (bán, tạm ngừng, đã huỷ).
 * Chuyến đang ở đâu trong vòng đời thì ngày đi và ngày về đã nói sẵn; lưu thêm
 * một bản là thêm một nguồn sự thật phải canh cho khỏi lệch.
 *
 * Viết thường, nối gạch ngang — nếp của giá trị SUY RA
 * (`ReviewModerationStateSchema`, mã lý do `departure-closed` của claim), để
 * không ai nhầm với giá trị enum trong DB (viết hoa).
 */
export const DeparturePhaseSchema = z.enum([
  'on-sale',
  'deadline-passed',
  'closed',
  'departed',
  'completed',
  'cancelled',
]);
export type DeparturePhase = z.output<typeof DeparturePhaseSchema>;

/**
 * Tính giai đoạn theo lịch Việt Nam. Luật xét từ trên xuống, dòng khớp đầu
 * tiên thắng — THỨ TỰ là một phần của luật (spec F16 §2a):
 *
 *  1. công tắc `CANCELLED` → `cancelled` (đã huỷ thì ngày tháng hết nghĩa);
 *  2. hôm nay SAU ngày về → `completed`;
 *  3. hôm nay từ ngày đi trở đi → `departed` (luật 2 đã loại phần sau ngày về,
 *     nên ngày về vẫn là `departed`);
 *  4. công tắc `CLOSED` → `closed` (ý muốn admin thắng hạn chót, nhưng chỉ ở
 *     chuyến chưa đi vì luật 2–3 đứng trên);
 *  5. quá hạn chót → `deadline-passed` — CÙNG vị từ `isWithinDeadline` mà cổng
 *     tạo booking dùng, nên `on-sale` đúng nghĩa "khách còn đặt được";
 *  6. còn lại → `on-sale`.
 *
 * Ngày khởi hành đã là `departed`, khớp hai cổng huỷ (hôm nay < ngày đi). Cổng
 * claim vẫn nhận khoản trả trễ trong chính ngày ấy — cố ý (ADR-0046); đừng
 * sửa hàm này cho "khớp" cổng claim.
 *
 * Tham số là MỘT object: `startDate` và `endDate` cùng kiểu chuỗi, truyền theo
 * vị trí thì tráo nhau mà không ai biết.
 */
export function departurePhase(input: {
  status: AdminDepartureStatus;
  /** Ngày lịch Việt Nam `YYYY-MM-DD`. */
  startDate: string;
  /** Ngày lịch Việt Nam `YYYY-MM-DD`. */
  endDate: string;
  now: Date;
}): DeparturePhase {
  const { status, startDate, endDate, now } = input;
  // Tính TRƯỚC khi xét công tắc: `now` hỏng thì `vietnamToday` ném RangeError
  // với MỌI công tắc, thay vì lọt qua ở nhánh `CANCELLED`.
  const today = vietnamToday(now);

  if (status === 'CANCELLED') return 'cancelled';
  // So CHUỖI ISO: thứ tự từ điển của `YYYY-MM-DD` trùng thứ tự thời gian.
  if (today > endDate) return 'completed';
  if (today >= startDate) return 'departed';
  if (status === 'CLOSED') return 'closed';
  if (!isWithinDeadline(now, startDate, endDate)) return 'deadline-passed';
  return 'on-sale';
}

/**
 * Bốn tab lọc của màn chuyến (All = không lọc). `upcoming` gom ba giai đoạn
 * CHƯA ĐI — đúng tập chuyến admin còn thao tác được (đóng/mở, huỷ); huy hiệu
 * trên từng hàng nói chi tiết.
 */
export const DeparturePhaseFilterSchema = z.enum([
  'upcoming',
  'departed',
  'completed',
  'cancelled',
]);
export type DeparturePhaseFilter = z.output<typeof DeparturePhaseFilterSchema>;

/** Nhóm lọc → các giai đoạn thuộc nhóm. Mỗi giai đoạn nằm ĐÚNG MỘT nhóm (có test). */
export const DEPARTURE_PHASE_FILTER_GROUPS: Readonly<
  Record<DeparturePhaseFilter, readonly DeparturePhase[]>
> = {
  upcoming: ['on-sale', 'deadline-passed', 'closed'],
  departed: ['departed'],
  completed: ['completed'],
  cancelled: ['cancelled'],
};
