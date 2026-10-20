import { ContractError } from '../../lib/contract-error.js';

/**
 * Lỗi nghiệp vụ của vùng chuyến khởi hành (spec P4e-1 F12, F13). Controller đổi chúng thành lỗi
 * contract bằng `toContractError` dùng chung — chỉ mã mà procedure KHAI mới đi qua. Trước G3
 * controller giữ một `mapError` riêng ba nhánh `instanceof`; file tách khỏi service theo khuôn
 * `admin-tour-errors.ts`, để test và controller đọc lỗi mà không kéo theo Prisma.
 *
 * Hai lỗi "không tìm thấy" tắt `exposeMessage`: câu mặc định contract khai cho từng procedure
 * đã đủ ("Tour not found" ở `list`/`create`, "Departure not found" ở ba lệnh ghi), còn câu của
 * service mang slug hay id — thứ để đọc log, không phải để trả về.
 */

export class TourNotFoundError extends ContractError<'NOT_FOUND'> {
  constructor(slug: string) {
    super('NOT_FOUND', `Tour ${slug} not found`, false);
  }
}

export class DepartureNotFoundError extends ContractError<'NOT_FOUND'> {
  constructor(id: string) {
    super('NOT_FOUND', `Departure ${id} not found`, false);
  }
}

/** Mã phán quyết nghiệp vụ — trùng TỪNG CHỮ với `errors` của contract. */
export type DepartureRuleCode =
  | 'INVALID_DATE_RANGE'
  | 'START_IN_PAST'
  | 'DEPARTURE_HAS_BOOKINGS'
  | 'SEATS_BELOW_BOOKED'
  | 'DEADLINE_PASSED'
  | 'DEPARTURE_CANCELLED'
  | 'DEPARTURE_STALE'
  /** F13: chuyến đã tới ngày khởi hành nên không còn huỷ được. */
  | 'DEPARTURE_STARTED'
  /** F12 vòng hai: ghế vượt cỡ nhóm tối đa mà tour công bố. */
  | 'SEATS_ABOVE_TOUR_MAX'
  /** Review A2 (M3-13): chuyến dài khác số ngày tour công bố. */
  | 'TRIP_LENGTH_MISMATCH';

/**
 * Một lệnh ghi bị luật nghiệp vụ chặn. `code` chọn đúng lỗi contract, `message` là câu đã mang
 * sẵn con số thật (xem `departure-rules.ts`) và đi nguyên ra client.
 */
export class DepartureRuleError extends ContractError<DepartureRuleCode> {}
