import { type BookingPhase, type BookingPhaseInput, bookingPhase } from '@tourism/contract';
import { filterTripsByWindow, isTravellingPhase, tripPillTone } from './trips-list';

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
