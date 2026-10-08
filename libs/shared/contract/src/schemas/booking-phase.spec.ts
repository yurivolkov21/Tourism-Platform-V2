import {
  ACTIVE_BOOKING_STATUSES,
  BookingPhaseSchema,
  BookingWhenSchema,
  bookingPhase,
  bookingWhen,
  calendarDaysBetween,
  tripDayNumbers,
} from './booking-phase.js';
import { BookingStatusSchema, type BookingStatusValue } from './bookings.js';

/**
 * Giai đoạn của một đơn (ADR-0054 §1, AMEND 1) — MỘT luật cho `bookings.mine` (lọc, xếp, đếm)
 * và ba trang đơn của web. Bộ này canh từng mốc biên: lệch một dấu so sánh là ra một bảng trông
 * hợp lý mà sai đúng vào ngày khách cần. "Hôm nay" là chuỗi ngày lịch Việt Nam.
 *
 * Chuyến mẫu 10/10 → 14/10, xét ở năm mốc: hôm trước ngày đi, ngày đi, giữa chuyến, ngày
 * về, hôm sau ngày về.
 */
const TRIP = { departureStartDate: '2026-10-10', departureEndDate: '2026-10-14' } as const;
const DAYS = ['2026-10-09', '2026-10-10', '2026-10-12', '2026-10-14', '2026-10-15'] as const;
/** Đơn chưa huỷ thật, chuyến còn chạy — mặc định của mọi ca không nói gì về huỷ. */
const LIVE = { cancelledAt: null, departureCancelled: false } as const;
/** Mốc của một lần huỷ thật — mọi đường huỷ thật đều ghi `cancelled_at` (AMEND 1). */
const CANCELLED_AT = '2026-10-01T08:00:00.000Z';

const TRIP_PATH = ['upcoming', 'on_tour', 'on_tour', 'on_tour', 'travelled'] as const;
const ALL_CANCELLED = ['cancelled', 'cancelled', 'cancelled', 'cancelled', 'cancelled'] as const;

describe('bookingPhase — từng trạng thái qua năm mốc ngày', () => {
  it.each([
    ['PAID', { status: 'PAID' }, TRIP_PATH],
    // Sự thật 4 của ADR-0054: hoàn một phần mà chuyến vẫn đi — đi đúng đường của PAID.
    ['PARTIALLY_REFUNDED', { status: 'PARTIALLY_REFUNDED' }, TRIP_PATH],
    // Chuyến năm ngày có N = 7, hạn chót 03/10: cả năm mốc đều đã qua hạn chót — hết cơ hội trả.
    ['PENDING', { status: 'PENDING' }, ['lapsed', 'lapsed', 'lapsed', 'lapsed', 'lapsed']],
    // CANCELLED tự nó là kết cục, không cần mốc (dữ liệu thật thì luôn có mốc).
    ['CANCELLED, kể cả thiếu cancelledAt', { status: 'CANCELLED' }, ALL_CANCELLED],
    // Sự thật 3: đơn huỷ thật có hoàn (REFUNDED kèm mốc huỷ) còn ngày đi tương lai KHÔNG được
    // vào nhóm sắp đi.
    [
      'REFUNDED có cancelledAt — huỷ thật, có hoàn',
      { status: 'REFUNDED', cancelledAt: CANCELLED_AT },
      ALL_CANCELLED,
    ],
    // AMEND 1: admin hoàn thiện chí TRỌN đặt REFUNDED mà không ghi mốc huỷ, không nhả ghế —
    // khách vẫn đi, nên đi đúng đường của PAID.
    ['REFUNDED không cancelledAt — hoàn thiện chí trọn', { status: 'REFUNDED' }, TRIP_PATH],
  ] as const)('%s', (_label, patch, expected) => {
    expect(DAYS.map((today) => bookingPhase({ ...TRIP, ...LIVE, ...patch }, today))).toEqual(
      expected,
    );
  });
});

/**
 * Chuyến bị CÔNG TY huỷ (ADR-0054 AMEND 1) thắng mọi trạng thái đơn. Trong khoảng chờ job
 * `departure-refund` (ADR-0041 AMEND 1) đơn vẫn PAID mà chuyến không chạy; seed lượt 1 mô hình
 * chuyến công ty huỷ bằng REFUNDED không `cancelledAt`. Chuyến không chạy thì cũng không bao giờ
 * thành `travelled`, nên cả năm mốc đều là `cancelled`.
 */
describe('bookingPhase — chuyến bị công ty huỷ', () => {
  const COMPANY_CANCELLED = { ...LIVE, departureCancelled: true } as const;

  it.each([
    ['PAID — job hoàn tiền chưa chạy', { status: 'PAID' }],
    ['PARTIALLY_REFUNDED — job hoàn tiền chưa chạy', { status: 'PARTIALLY_REFUNDED' }],
    ['REFUNDED không cancelledAt — seed lượt 1', { status: 'REFUNDED' }],
    ['REFUNDED có cancelledAt', { status: 'REFUNDED', cancelledAt: CANCELLED_AT }],
    ['CANCELLED', { status: 'CANCELLED', cancelledAt: CANCELLED_AT }],
  ] as const)('%s → cancelled ở cả năm mốc', (_label, patch) => {
    expect(
      DAYS.map((today) => bookingPhase({ ...TRIP, ...COMPANY_CANCELLED, ...patch }, today)),
    ).toEqual(ALL_CANCELLED);
  });

  it('PENDING: cancelled cả khi còn trong hạn chót, không mời trả tiền', () => {
    // 03/10 là hạn chót của TRIP: thiếu cờ thì vẫn là awaiting_payment.
    expect(bookingPhase({ status: 'PENDING', ...TRIP, ...LIVE }, '2026-10-03')).toBe(
      'awaiting_payment',
    );
    expect(bookingPhase({ status: 'PENDING', ...TRIP, ...COMPANY_CANCELLED }, '2026-10-03')).toBe(
      'cancelled',
    );
    expect(bookingPhase({ status: 'PENDING', ...TRIP, ...COMPANY_CANCELLED }, '2026-10-09')).toBe(
      'cancelled',
    );
  });
});

describe('bookingPhase — chuyến MỘT ngày', () => {
  const DAY_TRIP = { departureStartDate: '2026-10-10', departureEndDate: '2026-10-10' } as const;

  it.each([
    ['2026-10-09', 'upcoming'],
    ['2026-10-10', 'on_tour'],
    ['2026-10-11', 'travelled'],
  ] as const)('PAID, hôm nay %s → %s', (today, expected) => {
    expect(bookingPhase({ status: 'PAID', ...DAY_TRIP, ...LIVE }, today)).toBe(expected);
  });

  it('PENDING: hạn chót là hôm trước ngày đi (N = 1)', () => {
    expect(bookingPhase({ status: 'PENDING', ...DAY_TRIP, ...LIVE }, '2026-10-09')).toBe(
      'awaiting_payment',
    );
    expect(bookingPhase({ status: 'PENDING', ...DAY_TRIP, ...LIVE }, '2026-10-10')).toBe('lapsed');
  });
});

/**
 * Đơn chờ trả sống tới HẠN CHÓT, không tới ngày đi (review Phần A, 06/10): hạn chót là ngày cuối
 * nhận đặt (ADR-0041 §3), và quá mốc ấy API không mở phiên thanh toán mới nào nữa. Bản đầu lấy
 * mốc ngày đi nên đơn PayPal tạo lúc 23:30 ngày hạn chót (session sống 3 giờ) được mời trả tiền
 * rồi bị từ chối.
 */
describe('bookingPhase — PENDING theo hạn chót của chuyến', () => {
  // TRIP 10/10 → 14/10: năm ngày, N = 7, hạn chót 03/10.
  it.each([
    ['2026-10-02', 'awaiting_payment'],
    ['2026-10-03', 'awaiting_payment'],
    ['2026-10-04', 'lapsed'],
    ['2026-10-09', 'lapsed'],
  ] as const)('hôm nay %s → %s', (today, expected) => {
    expect(bookingPhase({ status: 'PENDING', ...TRIP, ...LIVE }, today)).toBe(expected);
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

  /**
   * AMEND 1 tách hai khái niệm: "còn hiệu lực" (còn huỷ được, `isCancellableStatus`) và "chuyến
   * còn đi". Đơn hoàn thiện chí trọn là REFUNDED — không còn gì để huỷ — mà khách vẫn đi.
   */
  it('khớp bookingPhase: tới giai đoạn chuyến đi là đơn còn hiệu lực, cộng REFUNDED chưa huỷ thật', () => {
    const tripPhases: readonly string[] = ['upcoming', 'on_tour', 'travelled'];
    const reachesTrip = (status: BookingStatusValue) =>
      DAYS.some((today) => tripPhases.includes(bookingPhase({ status, ...TRIP, ...LIVE }, today)));
    expect(BookingStatusSchema.options.filter(reachesTrip)).toEqual(
      BookingStatusSchema.options.filter(
        (status) => ACTIVE_BOOKING_STATUSES.includes(status) || status === 'REFUNDED',
      ),
    );
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
