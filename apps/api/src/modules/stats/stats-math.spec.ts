import { Prisma } from '../../generated/prisma/client.js';
import {
  average,
  dashboardWindow,
  fillDaySeries,
  grossAmount,
  monthWindow,
  ratePercent,
  statsPeriod,
  statsWindow,
  statsWindowFromRange,
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

describe('statsWindowFromRange', () => {
  // 04/09 lúc 10:30 — cùng mốc mà ví dụ của ADR-0028 §2 dùng.
  const NOW_SEP = new Date('2026-09-04T10:30:00.000Z');
  // Mốc SAU mọi khoảng bên dưới — để test hình dạng cửa sổ không bị AMEND 3
  // cắt ở `now` (ca cắt có test riêng).
  const LATER = new Date('2026-10-04T10:30:00.000Z');

  it('two ends in the PAST: this period is the whole month, the previous one is EQUALLY long', () => {
    const w = statsWindowFromRange('2026-09-01', '2026-09-30', new Date('2026-10-04T10:30:00Z'));
    expect(w.currentFrom.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    // Trọn ngày 30 → chặn ở 00:00 ngày 1 tháng sau, KHÔNG 23:59:59 (ADR-0028 §3).
    expect(w.currentTo.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    // 30 ngày lùi liền kề, khít với currentFrom.
    expect(w.previousFrom.toISOString()).toBe('2026-08-02T00:00:00.000Z');
    expect(w.picked).toBe(true);
  });

  it('the CURRENT month is cut at now, and the previous period is only as long as what has elapsed', () => {
    // ADR-0028 AMEND 3: /bookings độn trọn tháng hiện tại; đọc 04/09 mà so 5
    // ngày đã trôi với 30 ngày trọn của kỳ trước là một cú sụt bịa.
    const w = statsWindowFromRange('2026-09-01', '2026-09-30', NOW_SEP);
    expect(w.currentFrom.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(w.currentTo).toEqual(NOW_SEP);
    // span = 3 ngày 10h30 → kỳ trước lùi đúng bấy nhiêu.
    expect(w.previousFrom.toISOString()).toBe('2026-08-28T13:30:00.000Z');
    expect(w.picked).toBe(true);
  });

  it('`from` in the future gives an EMPTY period, never a negative one', () => {
    const w = statsWindowFromRange('2027-01-01', undefined, NOW_SEP);
    expect(w.currentFrom).toEqual(NOW_SEP);
    expect(w.currentTo).toEqual(NOW_SEP);
    expect(w.previousFrom).toEqual(NOW_SEP);
  });

  it('keeps both windows the same length whatever range is picked', () => {
    const w = statsWindowFromRange('2026-09-05', '2026-09-12', LATER);
    const current = w.currentTo.getTime() - w.currentFrom.getTime();
    const previous = w.currentFrom.getTime() - w.previousFrom.getTime();
    // Bất biến của cả ADR: pill delta chỉ nói thật khi hai kỳ bằng nhau.
    expect(current).toBe(previous);
    expect(current).toBe(8 * DAY);
  });

  it('from only: this period ends at now, the previous one matches its length', () => {
    const w = statsWindowFromRange('2026-09-01', undefined, NOW_SEP);
    expect(w.currentFrom.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(w.currentTo).toEqual(NOW_SEP);
    // span = 3 ngày 10h30 → previousFrom = currentFrom − span.
    expect(w.previousFrom.toISOString()).toBe('2026-08-28T13:30:00.000Z');
  });

  it('to only: takes exactly STATS_WINDOW_DAYS ending at that date', () => {
    const w = statsWindowFromRange(undefined, '2026-09-30', LATER);
    expect(w.currentTo.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(w.currentFrom.toISOString()).toBe('2026-09-03T00:00:00.000Z');
    expect(w.previousFrom.toISOString()).toBe('2026-08-06T00:00:00.000Z');
  });

  it('neither end: identical to the sliding 28-day window, and NOT picked', () => {
    expect(statsWindowFromRange(undefined, undefined, NOW_SEP)).toEqual(statsWindow(NOW_SEP));
    expect(statsWindow(NOW_SEP).picked).toBe(false);
  });

  it('a single day: this period is that day, the previous one is the day before', () => {
    const w = statsWindowFromRange('2026-09-04', '2026-09-04', LATER);
    expect(w.currentFrom.toISOString()).toBe('2026-09-04T00:00:00.000Z');
    expect(w.currentTo.toISOString()).toBe('2026-09-05T00:00:00.000Z');
    expect(w.previousFrom.toISOString()).toBe('2026-09-03T00:00:00.000Z');
  });

  it('a leap February keeps its 29 days — no hand-written month table', () => {
    const w = statsWindowFromRange(
      '2028-02-01',
      '2028-02-29',
      new Date('2028-03-02T00:00:00.000Z'),
    );
    expect(w.currentTo.toISOString()).toBe('2028-03-01T00:00:00.000Z');
    expect(w.currentTo.getTime() - w.currentFrom.getTime()).toBe(29 * DAY);
  });

  it('does not mutate the instant it was handed', () => {
    const now = new Date(NOW_SEP);
    statsWindowFromRange('2026-09-01', '2026-09-30', now);
    expect(now.toISOString()).toBe(NOW_SEP.toISOString());
  });
});

describe('statsPeriod', () => {
  it('serialises the window as UTC ISO plus the window length', () => {
    expect(statsPeriod(statsWindow(NOW))).toEqual({
      windowDays: 28,
      currentFrom: '2026-08-04T10:30:00.000Z',
      currentTo: '2026-09-01T10:30:00.000Z',
      previousFrom: '2026-07-07T10:30:00.000Z',
      generatedAt: '2026-09-01T10:30:00.000Z',
      picked: false,
    });
  });

  // Cửa sổ TRƯỢT kết đúng lúc chốt sổ, nên hai mốc trùng nhau — chính điều
  // kiện mà client dùng để chọn giữa caption "prior N days" và caption in
  // ngày thật (ADR-0028 §4).
  it('a sliding window ends exactly when the books were closed', () => {
    const period = statsPeriod(statsWindow(NOW));
    expect(period.currentTo).toBe(period.generatedAt);
  });

  it('measures windowDays from the window itself, not from the constant', () => {
    const w = statsWindowFromRange('2026-08-01', '2026-08-30', NOW);
    expect(statsPeriod(w).windowDays).toBe(30);
    expect(statsPeriod(w).picked).toBe(true);
  });

  // Contract khai `z.int().positive()`: làm tròn xuống 0 thì chính response
  // không parse nổi. Kỳ ngắn hơn một ngày vẫn là "một ngày" khi đếm bằng ngày.
  it('a window shorter than a day still reads as 1 day, never 0', () => {
    const w = statsWindowFromRange('2026-09-04', undefined, new Date('2026-09-04T02:00:00.000Z'));
    expect(statsPeriod(w).windowDays).toBe(1);
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

describe('dashboardWindow (ADR-0036)', () => {
  it('spans the last N calendar days INCLUDING today, ending at the instant asked', () => {
    // 7 ngày tính cả hôm nay (01/09): từ 00:00 UTC ngày 26/08 tới đúng `now`.
    // Khác `statsWindow`: không có hai kỳ để so, và người trực mở dashboard là
    // để xem HÔM NAY — bucket cuối là bucket đang chạy.
    const w = dashboardWindow(7, NOW);
    expect(w.days).toBe(7);
    expect(w.from.toISOString()).toBe('2026-08-26T00:00:00.000Z');
    expect(w.to.toISOString()).toBe('2026-09-01T10:30:00.000Z');
    expect(w.generatedAt.toISOString()).toBe('2026-09-01T10:30:00.000Z');
  });

  it('90 days crosses month boundaries by the calendar, not by 30-day blocks', () => {
    const w = dashboardWindow(90, NOW);
    expect(w.from.toISOString()).toBe('2026-06-04T00:00:00.000Z');
  });

  it('starts at 00:00.000 UTC even when now is just past midnight', () => {
    const w = dashboardWindow(30, new Date('2026-09-01T00:00:00.400Z'));
    expect(w.from.toISOString()).toBe('2026-08-03T00:00:00.000Z');
  });

  it('does not mutate the instant it was handed', () => {
    const now = new Date(NOW);
    dashboardWindow(7, now);
    expect(now.toISOString()).toBe(NOW.toISOString());
  });
});

describe('fillDaySeries (ADR-0036)', () => {
  const window = dashboardWindow(7, NOW);
  const row = (date: string, revenue: string, bookings: number) => ({
    day: new Date(`${date}T00:00:00.000Z`),
    revenue: new Prisma.Decimal(revenue),
    bookings,
    currency: 'USD',
  });

  it('emits exactly one point per calendar day, ascending, with zeros for empty days', () => {
    const points = fillDaySeries([row('2026-08-28', '120.50', 2)], window);
    expect(points).toHaveLength(7);
    expect(points.map((p) => p.date)).toEqual([
      '2026-08-26',
      '2026-08-27',
      '2026-08-28',
      '2026-08-29',
      '2026-08-30',
      '2026-08-31',
      '2026-09-01',
    ]);
    expect(points[2]).toEqual({ date: '2026-08-28', revenue: '120.50', bookings: 2 });
    // Ngày trống là '0.00'/0 — câu trả lời thật, không phải thiếu dữ liệu.
    expect(points[0]).toEqual({ date: '2026-08-26', revenue: '0.00', bookings: 0 });
    expect(points[6]).toEqual({ date: '2026-09-01', revenue: '0.00', bookings: 0 });
  });

  it('keeps money as a two-decimal string — never a float', () => {
    const [first] = fillDaySeries([row('2026-08-26', '1000', 1)], window);
    expect(first?.revenue).toBe('1000.00');
  });

  it('fills both edges of the window (first and last day carry their rows)', () => {
    const points = fillDaySeries(
      [row('2026-08-26', '1.00', 1), row('2026-09-01', '2.00', 1)],
      window,
    );
    expect(points[0]?.revenue).toBe('1.00');
    expect(points[6]?.revenue).toBe('2.00');
  });

  it('ignores rows outside the window instead of growing the series', () => {
    // Phòng thủ: SQL đã cắt `[from, to)`, nhưng hàm thuần không được tin
    // điều đó bằng cách kéo dài trục — độ dài chuỗi là bất biến của contract.
    const points = fillDaySeries([row('2026-08-25', '999.00', 9)], window);
    expect(points).toHaveLength(7);
    expect(points.every((p) => p.revenue === '0.00' && p.bookings === 0)).toBe(true);
  });

  it('an empty window (no rows at all) is a full series of zeros', () => {
    const points = fillDaySeries([], dashboardWindow(30, NOW));
    expect(points).toHaveLength(30);
    expect(points.at(-1)?.date).toBe('2026-09-01');
  });
});
