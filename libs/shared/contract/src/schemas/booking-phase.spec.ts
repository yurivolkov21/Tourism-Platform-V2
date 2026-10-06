import {
  ACTIVE_BOOKING_STATUSES,
  BookingPhaseSchema,
  BookingWhenSchema,
  bookingPhase,
  bookingWhen,
  calendarDaysBetween,
  tripDayNumbers,
} from './booking-phase.js';
import { BookingStatusSchema } from './bookings.js';

/**
 * Giai đoạn của một đơn (ADR-0054 §1) — MỘT luật cho `bookings.mine` (lọc, xếp, đếm) và ba
 * trang đơn của web. Bộ này canh từng mốc biên: lệch một dấu so sánh là ra một bảng trông
 * hợp lý mà sai đúng vào ngày khách cần. "Hôm nay" là chuỗi ngày lịch Việt Nam.
 *
 * Chuyến mẫu 10/10 → 14/10, xét ở năm mốc: hôm trước ngày đi, ngày đi, giữa chuyến, ngày
 * về, hôm sau ngày về.
 */
const TRIP = { departureStartDate: '2026-10-10', departureEndDate: '2026-10-14' } as const;
const DAYS = ['2026-10-09', '2026-10-10', '2026-10-12', '2026-10-14', '2026-10-15'] as const;

describe('bookingPhase — năm trạng thái qua năm mốc ngày', () => {
  it.each([
    ['PAID', ['upcoming', 'on_tour', 'on_tour', 'on_tour', 'travelled']],
    // Sự thật 4 của ADR-0054: hoàn một phần mà chuyến vẫn đi — đi đúng đường của PAID.
    ['PARTIALLY_REFUNDED', ['upcoming', 'on_tour', 'on_tour', 'on_tour', 'travelled']],
    // Chuyến năm ngày có N = 7, hạn chót 03/10: cả năm mốc đều đã qua hạn chót — hết cơ hội trả.
    ['PENDING', ['lapsed', 'lapsed', 'lapsed', 'lapsed', 'lapsed']],
    ['CANCELLED', ['cancelled', 'cancelled', 'cancelled', 'cancelled', 'cancelled']],
    // Sự thật 3: đơn REFUNDED còn ngày đi tương lai KHÔNG được vào nhóm sắp đi.
    ['REFUNDED', ['cancelled', 'cancelled', 'cancelled', 'cancelled', 'cancelled']],
  ] as const)('%s', (status, expected) => {
    expect(DAYS.map((today) => bookingPhase({ status, ...TRIP }, today))).toEqual(expected);
  });
});

describe('bookingPhase — chuyến MỘT ngày', () => {
  const DAY_TRIP = { departureStartDate: '2026-10-10', departureEndDate: '2026-10-10' } as const;

  it.each([
    ['2026-10-09', 'upcoming'],
    ['2026-10-10', 'on_tour'],
    ['2026-10-11', 'travelled'],
  ] as const)('PAID, hôm nay %s → %s', (today, expected) => {
    expect(bookingPhase({ status: 'PAID', ...DAY_TRIP }, today)).toBe(expected);
  });

  it('PENDING: hạn chót là hôm trước ngày đi (N = 1)', () => {
    expect(bookingPhase({ status: 'PENDING', ...DAY_TRIP }, '2026-10-09')).toBe('awaiting_payment');
    expect(bookingPhase({ status: 'PENDING', ...DAY_TRIP }, '2026-10-10')).toBe('lapsed');
  });
});

/**
 * Đơn chờ trả sống tới HẠN CHÓT, không tới ngày đi (review Phần A, 06/10): hạn chót là ngày cuối
 * nhận đặt (ADR-0041 §3) và cổng trả tiền của API đóng cùng mốc. Bản đầu lấy mốc ngày đi nên đơn
 * PayPal tạo lúc 23:30 ngày hạn chót (session sống 3 giờ) được mời trả tiền rồi bị từ chối.
 */
describe('bookingPhase — PENDING theo hạn chót của chuyến', () => {
  // TRIP 10/10 → 14/10: năm ngày, N = 7, hạn chót 03/10.
  it.each([
    ['2026-10-02', 'awaiting_payment'],
    ['2026-10-03', 'awaiting_payment'],
    ['2026-10-04', 'lapsed'],
    ['2026-10-09', 'lapsed'],
  ] as const)('hôm nay %s → %s', (today, expected) => {
    expect(bookingPhase({ status: 'PENDING', ...TRIP }, today)).toBe(expected);
  });
});

describe('bookingWhen — giai đoạn sang ba nhóm của bộ lọc When', () => {
  it.each([
    ['on_tour', 'ON_TOUR'],
    ['upcoming', 'UPCOMING'],
    ['awaiting_payment', 'UPCOMING'],
    ['travelled', 'PAST'],
    ['cancelled', 'PAST'],
    ['lapsed', 'PAST'],
  ] as const)('%s → %s', (phase, when) => {
    expect(bookingWhen(phase)).toBe(when);
  });

  it('sáu giai đoạn phủ đủ ba nhóm — không nhóm nào bỏ không', () => {
    const reached = new Set(BookingPhaseSchema.options.map(bookingWhen));
    expect([...reached].sort()).toEqual([...BookingWhenSchema.options].sort());
  });
});

describe('ACTIVE_BOOKING_STATUSES', () => {
  it('đúng PAID và PARTIALLY_REFUNDED', () => {
    expect(ACTIVE_BOOKING_STATUSES).toEqual(['PAID', 'PARTIALLY_REFUNDED']);
  });

  it('khớp bookingPhase: chỉ đơn còn hiệu lực mới tới được giai đoạn của chuyến đi', () => {
    const tripPhases: readonly string[] = ['upcoming', 'on_tour', 'travelled'];
    for (const status of BookingStatusSchema.options) {
      const reachesTrip = DAYS.some((today) =>
        tripPhases.includes(bookingPhase({ status, ...TRIP }, today)),
      );
      expect(reachesTrip).toBe(ACTIVE_BOOKING_STATUSES.includes(status));
    }
  });
});

describe('calendarDaysBetween — ngày lịch, không giờ', () => {
  it.each([
    ['2026-10-05', '2026-10-05', 0],
    ['2026-10-05', '2026-10-06', 1],
    ['2026-10-06', '2026-10-05', -1],
    ['2026-10-05', '2026-11-03', 29],
    ['2026-12-31', '2027-01-01', 1],
    ['2028-02-28', '2028-03-01', 2],
  ] as const)('%s → %s là %i ngày', (from, to, days) => {
    expect(calendarDaysBetween(from, to)).toBe(days);
  });

  it('ngày hỏng ném RangeError, không trả NaN', () => {
    expect(() => calendarDaysBetween('2026-02-30', '2026-03-01')).toThrow(RangeError);
    expect(() => calendarDaysBetween('2026-10-05', 'soon')).toThrow(RangeError);
  });
});

describe('tripDayNumbers — còn mấy ngày, ngày thứ mấy, dài mấy ngày', () => {
  it('trước chuyến: daysToGo dương, dayOfTrip chưa tới 1', () => {
    expect(tripDayNumbers(TRIP, '2026-10-07')).toEqual({
      daysToGo: 3,
      dayOfTrip: -2,
      tripLength: 5,
    });
  });

  it('ngày đi là ngày 1, ngày về là ngày cuối', () => {
    expect(tripDayNumbers(TRIP, '2026-10-10')).toEqual({
      daysToGo: 0,
      dayOfTrip: 1,
      tripLength: 5,
    });
    expect(tripDayNumbers(TRIP, '2026-10-14')).toEqual({
      daysToGo: -4,
      dayOfTrip: 5,
      tripLength: 5,
    });
  });

  it('chuyến vắt qua tháng', () => {
    const dates = { departureStartDate: '2026-10-30', departureEndDate: '2026-11-02' };
    expect(tripDayNumbers(dates, '2026-11-01')).toEqual({
      daysToGo: -2,
      dayOfTrip: 3,
      tripLength: 4,
    });
  });
});
