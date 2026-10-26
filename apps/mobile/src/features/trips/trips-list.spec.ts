import { type BookingPhase, type BookingPhaseInput, bookingPhase } from '@tourism/contract';
import {
  bookingStatusPill,
  filterTripsByWindow,
  isTravellingPhase,
  pickNextTrip,
  tripCardPill,
  tripPillTone,
} from './trips-list';

describe('filterTripsByWindow', () => {
  const PHASES: BookingPhase[] = [
    'awaiting_payment',
    'upcoming',
    'on_tour',
    'travelled',
    'cancelled',
    'lapsed',
  ];
  const items = PHASES.map((phase) => ({ phase }));
  const phasesIn = (window: 'all' | 'upcoming' | 'past') =>
    filterTripsByWindow(items, window).map((item) => item.phase);

  it('"all" trả nguyên mảng, kể cả đơn đã huỷ và đơn chờ trả quá hạn', () => {
    expect(filterTripsByWindow(items, 'all')).toEqual(items);
  });

  it('"upcoming" = còn trả được, sắp đi hoặc đang đi', () => {
    expect(phasesIn('upcoming')).toEqual(['awaiting_payment', 'upcoming', 'on_tour']);
  });

  it('"past" chỉ gồm chuyến đã đi — đơn huỷ và đơn chờ trả quá hạn chưa từng đi', () => {
    expect(phasesIn('past')).toEqual(['travelled']);
  });
});

describe('isTravellingPhase (luật vào cụm P)', () => {
  it('sắp đi, đang đi, đã về → cụm P', () => {
    expect(isTravellingPhase('upcoming')).toBe(true);
    expect(isTravellingPhase('on_tour')).toBe(true);
    expect(isTravellingPhase('travelled')).toBe(true);
  });

  it('chờ trả, quá hạn, đã huỷ → hoá đơn', () => {
    expect(isTravellingPhase('awaiting_payment')).toBe(false);
    expect(isTravellingPhase('lapsed')).toBe(false);
    expect(isTravellingPhase('cancelled')).toBe(false);
  });
});

// Các ca tab Trips từng xếp lệch web vì tự phân loại theo `status` (review 12/10, N3).
describe('đơn thật qua bookingPhase → chip và luật vào màn', () => {
  const TODAY = '2026-10-12';
  const phaseOf = (overrides: Partial<BookingPhaseInput>): BookingPhase =>
    bookingPhase(
      {
        status: 'PAID',
        departureStartDate: '2026-10-20',
        departureEndDate: '2026-10-22',
        cancelledAt: null,
        departureCancelled: false,
        ...overrides,
      },
      TODAY,
    );

  it('PARTIALLY_REFUNDED vẫn đi: nằm ở Upcoming và vào cụm P', () => {
    const phase = phaseOf({ status: 'PARTIALLY_REFUNDED' });
    expect(filterTripsByWindow([{ phase }], 'upcoming')).toHaveLength(1);
    expect(isTravellingPhase(phase)).toBe(true);
  });

  it('REFUNDED hoàn thiện chí (không cancelledAt) đã về: nằm ở Past và vào cụm P', () => {
    const phase = phaseOf({
      status: 'REFUNDED',
      departureStartDate: '2026-10-01',
      departureEndDate: '2026-10-03',
    });
    expect(filterTripsByWindow([{ phase }], 'past')).toHaveLength(1);
    expect(isTravellingPhase(phase)).toBe(true);
  });

  it('REFUNDED có cancelledAt là huỷ thật: không ở chip nào, đi hoá đơn', () => {
    const phase = phaseOf({ status: 'REFUNDED', cancelledAt: '2026-10-05T03:00:00.000Z' });
    expect(filterTripsByWindow([{ phase }], 'upcoming')).toEqual([]);
    expect(filterTripsByWindow([{ phase }], 'past')).toEqual([]);
    expect(isTravellingPhase(phase)).toBe(false);
  });

  it('PENDING của chuyến khởi hành hôm nay đã quá hạn chót: rời Upcoming', () => {
    const phase = phaseOf({
      status: 'PENDING',
      departureStartDate: TODAY,
      departureEndDate: TODAY,
    });
    expect(phase).toBe('lapsed');
    expect(filterTripsByWindow([{ phase }], 'upcoming')).toEqual([]);
  });

  it('PAID trên chuyến bị công ty huỷ: không "đang đi", không vào cụm P', () => {
    const phase = phaseOf({
      departureStartDate: '2026-10-11',
      departureEndDate: '2026-10-13',
      departureCancelled: true,
    });
    expect(phase).toBe('cancelled');
    expect(isTravellingPhase(phase)).toBe(false);
  });
});

describe('tripPillTone', () => {
  it('PAID → "paid"', () => {
    expect(tripPillTone('PAID')).toBe('paid');
  });

  it('PENDING → "pending"', () => {
    expect(tripPillTone('PENDING')).toBe('pending');
  });

  it('CANCELLED/REFUNDED/PARTIALLY_REFUNDED → "muted"', () => {
    expect(tripPillTone('CANCELLED')).toBe('muted');
    expect(tripPillTone('REFUNDED')).toBe('muted');
    expect(tripPillTone('PARTIALLY_REFUNDED')).toBe('muted');
  });
});

// Chữ giả lập bảng `messages.mobile.trips.status` — test khoá LUẬT chọn khoá chữ, không khoá copy.
const STATUS_WORDS = {
  PENDING: 'Payment due',
  PAID: 'Paid',
  CANCELLED: 'Cancelled',
  REFUNDED: 'Refunded',
  PARTIALLY_REFUNDED: 'Partially refunded',
};

// Chữ giả lập của `lapsed` (`messages.accountBookings.lapsedBadge` bên web).
const PILL_WORDS = { status: STATUS_WORDS, lapsed: 'Payment not completed' };

describe('bookingStatusPill (pill của thẻ Trips và hoá đơn)', () => {
  it('chuyến còn chạy: chữ và tông theo trạng thái đơn', () => {
    expect(
      bookingStatusPill({ status: 'PAID', departureCancelled: false }, 'upcoming', PILL_WORDS),
    ).toEqual({ tone: 'paid', label: 'Paid' });
    expect(
      bookingStatusPill(
        { status: 'PENDING', departureCancelled: false },
        'awaiting_payment',
        PILL_WORDS,
      ),
    ).toEqual({ tone: 'pending', label: 'Payment due' });
    expect(
      bookingStatusPill(
        { status: 'PARTIALLY_REFUNDED', departureCancelled: false },
        'upcoming',
        PILL_WORDS,
      ),
    ).toEqual({ tone: 'muted', label: 'Partially refunded' });
  });

  it('chuyến công ty huỷ mà job hoàn tiền chưa chạy (đơn còn PAID hay hoàn một phần) → "Cancelled" xám, không phải "Paid" xanh', () => {
    expect(
      bookingStatusPill({ status: 'PAID', departureCancelled: true }, 'cancelled', PILL_WORDS),
    ).toEqual({ tone: 'muted', label: 'Cancelled' });
    expect(
      bookingStatusPill(
        { status: 'PARTIALLY_REFUNDED', departureCancelled: true },
        'cancelled',
        PILL_WORDS,
      ),
    ).toEqual({ tone: 'muted', label: 'Cancelled' });
  });

  it('chuyến công ty huỷ: đơn đã huỷ giữ "Cancelled", đơn hoàn trọn giữ "Refunded"', () => {
    expect(
      bookingStatusPill({ status: 'CANCELLED', departureCancelled: true }, 'cancelled', PILL_WORDS),
    ).toEqual({ tone: 'muted', label: 'Cancelled' });
    expect(
      bookingStatusPill({ status: 'REFUNDED', departureCancelled: true }, 'cancelled', PILL_WORDS),
    ).toEqual({ tone: 'muted', label: 'Refunded' });
  });

  // G54: "Payment due" cam mời trả một khoản API không mở lại được sau hạn chót.
  it('đơn chờ trả quá hạn chót (`lapsed`) → chữ riêng, tông xám, không phải "Payment due" cam', () => {
    expect(
      bookingStatusPill({ status: 'PENDING', departureCancelled: false }, 'lapsed', PILL_WORDS),
    ).toEqual({ tone: 'muted', label: 'Payment not completed' });
  });
});

describe('tripCardPill (pill của thẻ Trips theo giai đoạn)', () => {
  const WORDS = { ...PILL_WORDS, onTourNow: 'On tour now' };

  it('đang đi → "On tour now" xanh, kể cả đơn đã hoàn một phần (khách vẫn đi tour)', () => {
    expect(
      tripCardPill({ status: 'PARTIALLY_REFUNDED', departureCancelled: false }, 'on_tour', WORDS),
    ).toEqual({ tone: 'paid', label: 'On tour now' });
  });

  it('chuyến công ty huỷ, đơn còn PAID (`bookingPhase` là `cancelled`) → "Cancelled" xám', () => {
    const booking = {
      status: 'PAID' as const,
      departureStartDate: '2026-10-11',
      departureEndDate: '2026-10-13',
      cancelledAt: null,
      departureCancelled: true,
    };
    expect(tripCardPill(booking, bookingPhase(booking, '2026-10-12'), WORDS)).toEqual({
      tone: 'muted',
      label: 'Cancelled',
    });
  });

  it('đơn chờ trả của chuyến khởi hành hôm nay đã qua hạn chót → chữ của `lapsed`, tông xám', () => {
    const booking = {
      status: 'PENDING' as const,
      departureStartDate: '2026-10-12',
      departureEndDate: '2026-10-14',
      cancelledAt: null,
      departureCancelled: false,
    };
    expect(tripCardPill(booking, bookingPhase(booking, '2026-10-12'), WORDS)).toEqual({
      tone: 'muted',
      label: 'Payment not completed',
    });
  });

  it('các giai đoạn còn lại đọc trạng thái đơn', () => {
    expect(tripCardPill({ status: 'PAID', departureCancelled: false }, 'upcoming', WORDS)).toEqual({
      tone: 'paid',
      label: 'Paid',
    });
    expect(
      tripCardPill({ status: 'PENDING', departureCancelled: false }, 'awaiting_payment', WORDS),
    ).toEqual({ tone: 'pending', label: 'Payment due' });
  });
});

describe('pickNextTrip (thẻ Next trip, B5)', () => {
  const trip = (code: string, phase: BookingPhase, startDate: string) => ({
    code,
    phase,
    startDate,
  });

  it('không có đơn nào thì không có thẻ', () => {
    expect(pickNextTrip([])).toBeNull();
  });

  it('không có đơn upcoming hoặc on_tour thì không có thẻ', () => {
    const items = [
      trip('a', 'awaiting_payment', '2026-11-01'),
      trip('b', 'travelled', '2026-09-01'),
      trip('c', 'cancelled', '2026-12-01'),
      trip('d', 'lapsed', '2026-10-25'),
    ];
    expect(pickNextTrip(items)).toBeNull();
  });

  it('chọn đơn upcoming có ngày đi sớm nhất', () => {
    const items = [
      trip('late', 'upcoming', '2026-12-01'),
      trip('soon', 'upcoming', '2026-11-03'),
      trip('mid', 'upcoming', '2026-11-20'),
    ];
    expect(pickNextTrip(items)?.code).toBe('soon');
  });

  it('đơn on_tour tính như ứng viên, ngày đi sớm hơn nên thắng đơn upcoming', () => {
    const items = [trip('future', 'upcoming', '2026-11-03'), trip('now', 'on_tour', '2026-10-18')];
    expect(pickNextTrip(items)?.code).toBe('now');
  });

  it('hai đơn trùng ngày: giữ đơn đứng trước trong danh sách (ổn định)', () => {
    const items = [
      trip('first', 'upcoming', '2026-11-03'),
      trip('second', 'upcoming', '2026-11-03'),
    ];
    expect(pickNextTrip(items)?.code).toBe('first');
  });
});
