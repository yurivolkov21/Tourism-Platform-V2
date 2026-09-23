import { type AdminDepartureRow, cancellationDeadline, departurePhase } from '@tourism/contract';
import { type DepartureRowVM, toDepartureRowVM } from '@/lib/departures-view';

/**
 * Fixture hàng chuyến cho test admin (spec F16 §4 mục 10, vòng review F16).
 *
 * Hàng thật do SERVER dựng, và hai field của nó suy từ hai ngày của chuyến:
 * `phase` (`departurePhase`) và `cancellationDeadline`. Điền tay hai field ấy
 * thì rất dễ ghép chúng sai với nhau hoặc với `today` — vòng review F16 bắt
 * được đúng một fixture ghi hạn chót 24/11 cho chuyến mà contract tính ra
 * 28/11, và một hàng như thế ghim một hành vi server không bao giờ gửi ra.
 * Nên fixture chỉ khai phần THÔ; phần suy ra do chính hàm của contract điền,
 * nhìn từ giữa trưa giờ Việt Nam của `today` — xa cả hai mốc nửa đêm.
 *
 * Đây là chỗ DUY NHẤT trong `apps/admin` được gọi `departurePhase`: code thật
 * của admin chỉ đọc `row.phase`.
 *
 * Một khuôn chung thay cho ba bản chép tay trong ba spec — cùng lý do với
 * `makeBooking` bên web: contract thêm một field là sửa đúng một chỗ.
 */
export type DepartureRowFixture = Omit<AdminDepartureRow, 'phase' | 'cancellationDeadline'>;

/** Chuyến 5 ngày 10/10 → 14/10 (N = 7, hạn chót 03/10), giá thừa hưởng, 4/20 ghế. */
const BASE: DepartureRowFixture = {
  id: '4f1b1f2e-0000-4000-8000-000000000001',
  startDate: '2026-10-10',
  endDate: '2026-10-14',
  price: '129.00',
  priceOverride: null,
  currency: 'USD',
  seatsBooked: 4,
  seatsTotal: 20,
  status: 'OPEN',
  liveBookingCount: 2,
  pendingBookingCount: 0,
  version: '2026-09-20T08:00:00.000Z',
};

/** Hàng thô mặc định, đè từng field khi ca test cần. */
export function makeDepartureRow(
  overrides: Partial<DepartureRowFixture> = {},
): DepartureRowFixture {
  return { ...BASE, ...overrides };
}

/** Hàng đúng như server gửi xuống khi nó nhìn từ ngày `today`. */
export function serverRow(row: DepartureRowFixture, today: string): AdminDepartureRow {
  return {
    ...row,
    cancellationDeadline: cancellationDeadline(row.startDate, row.endDate),
    phase: departurePhase({
      status: row.status,
      startDate: row.startDate,
      endDate: row.endDate,
      now: noonInVietnam(today),
    }),
  };
}

/** VM của một hàng ở ngày `today` — hàng và `today` không bao giờ nói khác nhau. */
export function vmAt(row: DepartureRowFixture, today: string): DepartureRowVM {
  return toDepartureRowVM(serverRow(row, today), today);
}

/** 12:00 giờ Việt Nam (05:00 UTC) của một ngày lịch. */
function noonInVietnam(day: string): Date {
  return new Date(`${day}T05:00:00.000Z`);
}
