import { Prisma } from '../../generated/prisma/client.js';
import {
  average,
  grossAmount,
  monthWindow,
  ratePercent,
  statsPeriod,
  statsWindow,
} from './stats-math.js';

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

/**
 * F6 — cửa sổ THÁNG của báo cáo (spec P4b §3-F6). Khác `statsWindow` ở chỗ nó
 * không neo vào "bây giờ": tháng 7 là tháng 7 dù đọc lúc nào, nên cùng một
 * `?month=` phải cho cùng một khoảng mãi mãi.
 */
describe('monthWindow', () => {
  it('cắt trọn một tháng lịch UTC, biên nửa-mở [đầu tháng, đầu tháng sau)', () => {
    const w = monthWindow('2026-09');
    expect(w.from.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(w.to.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('tháng 12 nhảy sang năm sau', () => {
    const w = monthWindow('2026-12');
    expect(w.from.toISOString()).toBe('2026-12-01T00:00:00.000Z');
    expect(w.to.toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('tháng 2 dài đúng bằng chính nó — 28 ngày, và 29 ngày ở năm nhuận', () => {
    expect(monthWindow('2026-02').to.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(monthWindow('2024-02').to.toISOString()).toBe('2024-03-01T00:00:00.000Z');
    const leap = monthWindow('2024-02');
    expect((leap.to.getTime() - leap.from.getTime()) / DAY).toBe(29);
  });

  it('hai tháng liền kề khít nhau — không row nào bị đếm hai lần', () => {
    expect(monthWindow('2026-09').to).toEqual(monthWindow('2026-10').from);
  });
});
