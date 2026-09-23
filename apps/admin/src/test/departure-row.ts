import { type AdminDepartureRow, departurePhase } from '@tourism/contract';

/**
 * Fixture hàng chuyến cho test admin (spec F16 §4 mục 10).
 *
 * Từ F16 mỗi `AdminDepartureRow` chở `phase` do SERVER tính. Điền tay thì rất
 * dễ ghép một `phase` với một `today` nói khác nó — vd `'on-sale'` cho một hàng
 * mà `today` đã qua ngày đi — rồi ghim một hành vi không bao giờ xảy ra thật.
 * Helper tính `phase` bằng CHÍNH hàm của server, ở giữa trưa giờ Việt Nam của
 * `today`, xa cả hai mốc nửa đêm.
 *
 * Đây là chỗ DUY NHẤT trong `apps/admin` được gọi `departurePhase`: code thật
 * của admin chỉ đọc `row.phase`.
 */
export type DepartureRowFixture = Omit<AdminDepartureRow, 'phase'>;

/** 12:00 giờ Việt Nam (05:00 UTC) của một ngày lịch. */
export function noonInVietnam(day: string): Date {
  return new Date(`${day}T05:00:00.000Z`);
}

export function withPhase(row: DepartureRowFixture, today: string): AdminDepartureRow {
  return {
    ...row,
    phase: departurePhase({
      status: row.status,
      startDate: row.startDate,
      endDate: row.endDate,
      now: noonInVietnam(today),
    }),
  };
}
