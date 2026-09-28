import type { TourReadiness } from '@tourism/contract';
import { ContractError } from '../../lib/contract-error.js';

/**
 * Lỗi nghiệp vụ của khu làm việc tour (spec F17). Controller đổi chúng thành
 * lỗi contract bằng `toContractError` — chỉ mã mà procedure KHAI mới đi qua.
 *
 * Tên có tiền tố riêng: repo đã có năm lớp tên `TourNotFoundError` ở năm module
 * (bài học vòng hai F12), trong đó một lớp ngay ở `admin-catalog.service.ts`.
 */

export class AdminTourNotFoundError extends ContractError<'NOT_FOUND'> {
  constructor(ref: string) {
    super('NOT_FOUND', `Tour not found: ${ref}`, false);
  }
}

/** Danh mục hay điểm đến không tồn tại — khoá ngoại `P2003` ở lệnh tạo hoặc sửa. */
export class TourLinkNotFoundError extends ContractError<'NOT_FOUND'> {
  constructor() {
    super('NOT_FOUND', 'Category or destination not found', false);
  }
}

/** Slug đã có tour khác dùng. 409: input đúng, thế giới đã đổi. */
export class TourSlugTakenError extends ContractError<'SLUG_TAKEN'> {
  constructor(slug: string) {
    super('SLUG_TAKEN', `Another tour already uses the slug ${slug}`);
  }
}

/** Phiên bản trong form không còn khớp hàng tour (ADR-0047 §3). */
export class StaleTourError extends ContractError<'STALE_TOUR'> {
  constructor() {
    super('STALE_TOUR', 'This tour changed since it was opened.');
  }
}

/** Hai luật giữ dữ liệu khớp (ADR-0047 §6). */
export class TourRuleError extends ContractError<'DURATION_LOCKED' | 'GROUP_SIZE_BELOW_SEATS'> {}

/**
 * Tour thiếu thứ khách cần (ADR-0047 §4). Câu liệt kê đúng chỗ thiếu để API
 * đọc được một mình; admin tự dựng câu của nó từ `tourReadiness`.
 */
export class TourNotReadyError extends ContractError<'TOUR_NOT_READY'> {
  constructor(readonly readiness: TourReadiness) {
    super('TOUR_NOT_READY', `This tour is missing: ${missingParts(readiness).join(', ')}.`);
  }
}

function missingParts(readiness: TourReadiness): string[] {
  return [
    ...(readiness.summary ? [] : ['a summary']),
    ...(readiness.primaryDestination ? [] : ['one primary destination']),
    ...(readiness.missingDays.length > 0
      ? [`itinerary for day ${readiness.missingDays.join(', ')}`]
      : []),
    ...(readiness.cover ? [] : ['a cover photo']),
  ];
}

/** Khoá ngoại `Restrict` của booking chặn lệnh xoá (ADR-0047 §5). */
export class TourHasBookingsError extends ContractError<'TOUR_HAS_BOOKINGS'> {
  constructor() {
    super(
      'TOUR_HAS_BOOKINGS',
      'This tour has bookings, so it cannot be deleted. Take it off sale instead.',
    );
  }
}

/**
 * Ngày lịch trình vượt số ngày của tour SAU khi phiên bản đã khớp — client hỏng,
 * không phải thế giới đổi. Controller trả 400; KHÔNG phải `ContractError` vì
 * danh sách mã contract là cố định (plan F17, quyết định 6).
 */
export class ItineraryDayOutOfRangeError extends Error {}
