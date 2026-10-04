import { filterTripsByWindow, tripPillTone } from './trips-list';

const TODAY = '2026-10-01';

describe('filterTripsByWindow', () => {
  const items = [
    { departureStartDate: '2026-09-15' }, // past
    { departureStartDate: '2026-10-01' }, // hôm nay tính là upcoming
    { departureStartDate: '2026-10-20' }, // upcoming
  ];

  it('"all" trả nguyên mảng', () => {
    expect(filterTripsByWindow(items, 'all', TODAY)).toEqual(items);
  });

  it('"upcoming" giữ ngày ≥ hôm nay', () => {
    expect(filterTripsByWindow(items, 'upcoming', TODAY)).toEqual([items[1], items[2]]);
  });

  it('"past" giữ ngày < hôm nay', () => {
    expect(filterTripsByWindow(items, 'past', TODAY)).toEqual([items[0]]);
  });

  it('"upcoming" bỏ booking đã huỷ/hoàn dù ngày đi còn tới', () => {
    const mixed = [
      { departureStartDate: '2026-10-20', status: 'PAID' },
      { departureStartDate: '2026-10-20', status: 'CANCELLED' },
      { departureStartDate: '2026-10-20', status: 'REFUNDED' },
      { departureStartDate: '2026-10-20', status: 'PARTIALLY_REFUNDED' },
    ];
    expect(filterTripsByWindow(mixed, 'upcoming', TODAY)).toEqual([mixed[0]]);
    expect(filterTripsByWindow(mixed, 'all', TODAY)).toEqual(mixed);
  });

  it('"past" cũng bỏ booking đã huỷ/hoàn (chưa từng đi)', () => {
    const done = [
      { departureStartDate: '2026-09-15', status: 'PAID' },
      { departureStartDate: '2026-09-15', status: 'CANCELLED' },
      { departureStartDate: '2026-09-15', status: 'REFUNDED' },
    ];
    expect(filterTripsByWindow(done, 'past', TODAY)).toEqual([done[0]]);
  });

  it('chuyến đang đi (ngày đi đã qua, ngày về chưa tới) nằm ở "upcoming", không ở "past"', () => {
    const onTour = [{ departureStartDate: '2026-09-30', departureEndDate: '2026-10-03' }];
    expect(filterTripsByWindow(onTour, 'upcoming', TODAY)).toEqual(onTour);
    expect(filterTripsByWindow(onTour, 'past', TODAY)).toEqual([]);
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
