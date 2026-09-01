import { Prisma } from '../../generated/prisma/client.js';
import { average, grossAmount, ratePercent, statsPeriod, statsWindow } from './stats-math.js';

/**
 * TDD suite (spec P4b §3-F5, viết TRƯỚC) cho phần THUẦN của stats: cửa sổ hai
 * kỳ và ba phép biến số DB → chuỗi contract. Aggregate thật chạy trên Postgres
 * ở `stats.int.spec.ts`.
 */

const NOW = new Date('2026-09-01T10:30:00.000Z');
const DAY = 86_400_000;

describe('statsWindow', () => {
  it('cuts two windows of EQUAL length, back to back, ending at now', () => {
    // Bằng nhau là điều kiện để phép so sánh có nghĩa: một kỳ 27 ngày rưỡi
    // (căn theo nửa đêm) so với một kỳ 28 ngày luôn trông như đang tụt.
    const w = statsWindow(NOW);
    expect(w.generatedAt.getTime() - w.currentFrom.getTime()).toBe(28 * DAY);
    expect(w.currentFrom.getTime() - w.previousFrom.getTime()).toBe(28 * DAY);
  });

  it('anchors on the given instant — no hidden Date.now()', () => {
    const w = statsWindow(NOW);
    expect(w.generatedAt.toISOString()).toBe('2026-09-01T10:30:00.000Z');
    expect(w.currentFrom.toISOString()).toBe('2026-08-04T10:30:00.000Z');
    expect(w.previousFrom.toISOString()).toBe('2026-07-07T10:30:00.000Z');
  });

  it('does not mutate the instant it was handed', () => {
    const now = new Date(NOW);
    statsWindow(now);
    expect(now.toISOString()).toBe(NOW.toISOString());
  });
});

describe('statsPeriod', () => {
  it('serialises the window as UTC ISO plus the window length', () => {
    expect(statsPeriod(statsWindow(NOW))).toEqual({
      windowDays: 28,
      currentFrom: '2026-08-04T10:30:00.000Z',
      previousFrom: '2026-07-07T10:30:00.000Z',
      generatedAt: '2026-09-01T10:30:00.000Z',
    });
  });
});

describe('grossAmount', () => {
  it('keeps two decimals, never a float', () => {
    expect(grossAmount(new Prisma.Decimal('1240.5'))).toBe('1240.50');
  });

  it('an empty window sums to 0.00, not null — nothing earned IS an answer', () => {
    expect(grossAmount(null)).toBe('0.00');
  });
});

describe('ratePercent', () => {
  it('returns a 0..100 percentage with one decimal', () => {
    expect(ratePercent(1, 12)).toBe('8.3');
    expect(ratePercent(3, 4)).toBe('75.0');
  });

  it('zero numerator over a real denominator is a true 0.0', () => {
    expect(ratePercent(0, 9)).toBe('0.0');
  });

  it('no denominator → null, NOT "0.0" — a rate nobody can compute is not zero', () => {
    expect(ratePercent(0, 0)).toBeNull();
    expect(ratePercent(3, 0)).toBeNull();
  });
});

describe('average', () => {
  it('renders two decimals', () => {
    expect(average(4.6)).toBe('4.60');
    expect(average(4.333333)).toBe('4.33');
  });

  it('a window with no rows has no average — null, not 0', () => {
    expect(average(null)).toBeNull();
  });
});
