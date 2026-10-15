import { describe, expect, it } from 'vitest';
import { feedsTourCard, nextDepartureOf } from './card-departures.js';

/**
 * Luật "đợt nuôi thẻ tour" (ADR-0058 §1–§2) — THUẦN, nên mọi biên kiểm được mà không cần DB.
 * Một vị từ cho cả ba thứ đọc nó: giá "from", đợt kế tiếp trên thẻ, và tag cache của lệnh ghi đợt.
 */

// "Hôm nay" 01/10 giờ Việt Nam; chuyến 5 ngày khởi hành 10/10 → N = 7 → hạn chót 03/10.
const NOW = new Date('2026-10-01T05:00:00Z');
const BOOKABLE = {
  status: 'OPEN' as const,
  startDate: '2026-10-10',
  endDate: '2026-10-14',
  seatsLeft: 6,
};

describe('feedsTourCard', () => {
  it('đợt OPEN, còn hạn đặt, còn chỗ thì nuôi thẻ', () => {
    expect(feedsTourCard(BOOKABLE, NOW)).toBe(true);
  });

  it('đợt đã đóng hay đã bị huỷ thì không', () => {
    expect(feedsTourCard({ ...BOOKABLE, status: 'CLOSED' }, NOW)).toBe(false);
    expect(feedsTourCard({ ...BOOKABLE, status: 'CANCELLED' }, NOW)).toBe(false);
  });

  it('đợt hết chỗ thì không — thẻ không in giá hay ngày của một đợt khách không đặt được', () => {
    expect(feedsTourCard({ ...BOOKABLE, seatsLeft: 0 }, NOW)).toBe(false);
    expect(feedsTourCard({ ...BOOKABLE, seatsLeft: 1 }, NOW)).toBe(true);
  });

  it('hạn chót tính theo ngày VIỆT NAM: hết 03/10 giờ VN là thôi nuôi thẻ', () => {
    // 2026-10-03T16:59:59Z = 23:59:59 ngày 03/10 giờ VN — vẫn trong hạn.
    expect(feedsTourCard(BOOKABLE, new Date('2026-10-03T16:59:59Z'))).toBe(true);
    // 17:00Z = 00:00 ngày 04/10 giờ VN — đã qua hạn dù theo UTC vẫn là ngày 03.
    expect(feedsTourCard(BOOKABLE, new Date('2026-10-03T17:00:00Z'))).toBe(false);
  });
});

describe('nextDepartureOf', () => {
  it('không còn đợt nào đặt được thì null', () => {
    expect(nextDepartureOf([], NOW)).toBeNull();
    expect(nextDepartureOf([{ ...BOOKABLE, seatsLeft: 0 }], NOW)).toBeNull();
  });

  it('lấy đợt SỚM NHẤT bất kể thứ tự truyền vào', () => {
    const later = { ...BOOKABLE, startDate: '2026-11-02', endDate: '2026-11-06', seatsLeft: 9 };
    const sooner = { ...BOOKABLE, seatsLeft: 2 };

    expect(nextDepartureOf([later, sooner], NOW)).toEqual({
      startDate: '2026-10-10',
      seatsLeft: 2,
    });
  });

  it('bỏ qua đợt không nuôi thẻ dù nó sớm hơn — hết chỗ, đã đóng, quá hạn đặt', () => {
    const departures = [
      { ...BOOKABLE, startDate: '2026-10-05', endDate: '2026-10-05', seatsLeft: 0 },
      { ...BOOKABLE, startDate: '2026-10-06', endDate: '2026-10-06', status: 'CLOSED' as const },
      // Chuyến một ngày khởi hành 01/10: hạn chót 30/09 đã qua.
      { ...BOOKABLE, startDate: '2026-10-01', endDate: '2026-10-01' },
      { ...BOOKABLE, startDate: '2026-10-20', endDate: '2026-10-24', seatsLeft: 4 },
    ];

    expect(nextDepartureOf(departures, NOW)).toEqual({ startDate: '2026-10-20', seatsLeft: 4 });
  });

  it('hai đợt cùng ngày thì lấy đợt còn NHIỀU chỗ hơn — thẻ không báo sắp kín oan', () => {
    const tight = { ...BOOKABLE, seatsLeft: 2 };
    const roomy = { ...BOOKABLE, seatsLeft: 11 };

    expect(nextDepartureOf([tight, roomy], NOW)?.seatsLeft).toBe(11);
    expect(nextDepartureOf([roomy, tight], NOW)?.seatsLeft).toBe(11);
  });

  it('chỉ trả đúng hai trường của contract, không kéo theo cột nào của hàng', () => {
    const row = { ...BOOKABLE, id: 'x', priceOverride: '99.00' };

    expect(nextDepartureOf([row], NOW)).toStrictEqual({ startDate: '2026-10-10', seatsLeft: 6 });
  });
});
