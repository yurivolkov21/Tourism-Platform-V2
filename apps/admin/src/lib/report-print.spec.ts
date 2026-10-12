import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { emptyMonthReport, lossMonthReport, septemberReport } from '@/test/monthly-report';
import {
  accountingAmount,
  axisMoney,
  niceTicks,
  reportPrintView,
  shortMoney,
  statusBarView,
  waterfallView,
} from './report-print';

/**
 * Bản in báo cáo tháng C2 (G40 Phần 2, spec 2026-10-10 §5) — view-model THUẦN: chữ, số và hình học
 * của tờ in đều test ở đây; component chỉ vẽ. Báo cáo mẫu ở `@/test/monthly-report`.
 */
/** Dấu trừ thật U+2212 của nhãn ngắn — không phải gạch nối ASCII. */
const MINUS = '\u2212';

describe('shortMoney — nhãn ngắn ở đầu cột thác nước', () => {
  it('dưới 1,000 in số tròn; từ 1,000 in nghìn một số lẻ; số âm dùng dấu trừ thật', () => {
    expect(shortMoney(992.4, 'USD')).toBe('$992');
    expect(shortMoney(39607.8, 'USD')).toBe('$39.6k');
    expect(shortMoney(-25737.54, 'USD')).toBe(`${MINUS}$25.7k`);
    expect(shortMoney(-991.5, 'USD')).toBe(`${MINUS}$992`);
  });

  it('làm tròn đồng TRƯỚC khi chọn đơn vị, và làm tròn nửa lên không qua float', () => {
    expect(shortMoney(999.5, 'USD')).toBe('$1.0k');
    // 1,150 / 1,000 = 1.15 không biểu diễn đúng trong float: toFixed(1) cho "1.1".
    expect(shortMoney(-1150, 'USD')).toBe(`${MINUS}$1.2k`);
    expect(shortMoney(999_949, 'USD')).toBe('$999.9k');
    expect(shortMoney(999_950, 'USD')).toBe('$1.0M');
    expect(shortMoney(1_234_567, 'USD')).toBe('$1.2M');
  });

  it('không có "−$0": số tròn ra 0 in $0', () => {
    expect(shortMoney(0, 'USD')).toBe('$0');
    expect(shortMoney(-0.4, 'USD')).toBe('$0');
  });

  it('ký hiệu theo đồng tiền; mã chữ cách số một khoảng; mã sai thì in chính mã', () => {
    expect(shortMoney(1500, 'EUR')).toBe('€1.5k');
    expect(shortMoney(1500, 'ZZZ')).toBe('ZZZ 1.5k');
    expect(shortMoney(1500, 'U$D')).toBe('U$D 1.5k');
  });
});

describe('axisMoney — nhãn vạch lưới', () => {
  it('bỏ đuôi .0, giữ một số lẻ khi cần', () => {
    expect(axisMoney(0, 'USD')).toBe('$0');
    expect(axisMoney(500, 'USD')).toBe('$500');
    expect(axisMoney(2500, 'USD')).toBe('$2.5k');
    expect(axisMoney(20000, 'USD')).toBe('$20k');
    expect(axisMoney(-10000, 'USD')).toBe(`${MINUS}$10k`);
    expect(axisMoney(1_500_000, 'USD')).toBe('$1.5M');
    expect(axisMoney(0.3, 'USD')).toBe('$0.3');
  });
});

describe('accountingAmount — số của bảng lãi lỗ', () => {
  it('hai số lẻ, nhóm nghìn, âm trong ngoặc, không ký hiệu tiền', () => {
    expect(accountingAmount('39607.80')).toBe('39,607.80');
    expect(accountingAmount('-1234.5')).toBe('(1,234.50)');
  });

  it('dòng chi phí in âm; 0 không có ngoặc; đảo dấu một số âm ra dương', () => {
    expect(accountingAmount('25737.54', { negate: true })).toBe('(25,737.54)');
    expect(accountingAmount('0.00', { negate: true })).toBe('0.00');
    expect(accountingAmount('-1234.5', { negate: true })).toBe('1,234.50');
  });

  it('định dạng trên chính chuỗi thập phân, không qua float', () => {
    expect(accountingAmount('90071992547409.99')).toBe('90,071,992,547,409.99');
  });
});

describe('niceTicks — vạch lưới tròn', () => {
  it('số của bản thảo: 0, 20k, 40k (vạch trên vượt đỉnh không quá 2%)', () => {
    expect(niceTicks(0, 39607.8)).toEqual([0, 20000, 40000]);
  });

  it('hoà số vạch thì chọn bước nhỏ hơn', () => {
    // Bước 10k ra 4 vạch, bước 20k ra 2 — cùng cách 3 một vạch.
    expect(niceTicks(-5000, 30000)).toEqual([0, 10000, 20000, 30000]);
  });

  it('tháng lỗ toàn âm: vạch âm tới 0', () => {
    expect(niceTicks(-12000, 0)).toEqual([-10000, -5000, 0]);
  });
});

describe('waterfallView — hình học thác nước', () => {
  const view = waterfallView(septemberReport);
  if (!view) throw new Error('tháng 9 phải có thác nước');
  const bar = (key: string) => {
    const found = view.bars.find((b) => b.key === key);
    if (!found) throw new Error(key);
    return found;
  };
  // Tháng 9: đáy thấp nhất có nhãn dưới là lãi ròng 8,080.84 — không ép tỉ lệ, nên đỉnh 39,607.80 ở
  // y 20 và trục 0 ở y 194 (khung bản thảo: trên 20, dưới 42 của 236).
  const y = (v: number) => 20 + ((39607.8 - v) * 174) / 39607.8;

  it('bảy cột đúng thứ tự, loại và tông; nhãn hai dòng lấy từ i18n', () => {
    expect(view.bars.map((b) => [b.key, b.kind, b.tone])).toEqual([
      ['recognizedRevenue', 'total', 'gain'],
      ['cogsVariable', 'down', 'cost'],
      ['cogsFixed', 'down', 'cost'],
      ['grossProfit', 'total', 'gain'],
      ['taxAmount', 'down', 'cost'],
      ['paymentFees', 'down', 'cost'],
      ['netProfit', 'total', 'gain'],
    ]);
    expect(bar('cogsFixed').category.lines).toEqual(
      messages.admin.reports.printDoc.waterfall.cogsFixed,
    );
    expect(view.categoryY).toEqual([209, 220]);
    expect(view.label).toBe('Profit and loss waterfall, September 2026');
  });

  it('cột tổng đứng trên trục 0; cột trừ treo từ mức đang chạy', () => {
    expect(bar('recognizedRevenue').top).toBeCloseTo(20, 2);
    expect(bar('recognizedRevenue').bottom).toBeCloseTo(194, 2);
    expect(bar('cogsVariable').top).toBeCloseTo(20, 2);
    expect(bar('cogsVariable').bottom).toBeCloseTo(y(13870.26), 2);
    expect(bar('cogsFixed').top).toBeCloseTo(y(13870.26), 2);
    expect(bar('cogsFixed').bottom).toBeCloseTo(y(9918.26), 2);
    expect(bar('grossProfit').top).toBeCloseTo(y(9918.26), 2);
    expect(bar('netProfit').top).toBeCloseTo(y(8080.84), 2);
    expect(bar('netProfit').bottom).toBeCloseTo(194, 2);
  });

  it('nối bậc ở mức đang chạy, từ mép phải cột này tới mép trái cột sau', () => {
    expect(view.connectors).toHaveLength(6);
    const [first, second] = view.connectors;
    expect(first?.y).toBeCloseTo(20, 2);
    expect(second?.y).toBeCloseTo(y(13870.26), 2);
    expect(first?.x1).toBeCloseTo(bar('recognizedRevenue').x + bar('recognizedRevenue').width, 2);
    expect(first?.x2).toBeCloseTo(bar('cogsVariable').x, 2);
  });

  it('nhãn: cột tổng dương ở trên đỉnh, cột trừ ở dưới đáy, chữ ngắn có dấu trừ', () => {
    expect(bar('recognizedRevenue').label).toMatchObject({ text: '$39.6k' });
    expect(bar('recognizedRevenue').label.y).toBeCloseTo(15, 2);
    expect(bar('cogsVariable').label.text).toBe(`${MINUS}$25.7k`);
    expect(bar('cogsVariable').label.y).toBeCloseTo(y(13870.26) + 11, 2);
    expect(bar('taxAmount').label.text).toBe(`${MINUS}$902`);
    expect(bar('netProfit').label.text).toBe('$8.1k');
  });

  it('vạch lưới 0, 20k, 40k; chỉ vạch 0 là trục đậm', () => {
    expect(view.grid.map((g) => [g.label, g.base])).toEqual([
      ['$0', true],
      ['$20k', false],
      ['$40k', false],
    ]);
    expect(view.grid[0]?.y).toBeCloseTo(194, 2);
    expect(view.gridX).toEqual([6, 474]);
    expect(view.grid[2]?.y).toBeCloseTo(y(40000), 2);
  });

  it('chừa 30 đơn vị bên phải cho nhãn trục: không cột nào lấn vào', () => {
    for (const b of view.bars) expect(b.x + b.width).toBeLessThanOrEqual(480 - 6 - 30);
    expect(bar('recognizedRevenue').width).toBeCloseTo((438 / 7) * 0.62, 2);
  });

  it('đầu dữ liệu bo, chân vuông: cột tổng dương bo ở đỉnh, cột trừ bo ở đáy', () => {
    const total = bar('recognizedRevenue');
    // Đường đi bắt đầu ở chân trái (vuông) rồi mới lên đỉnh bo.
    expect(total.path.startsWith(`M${total.x.toFixed(2)} ${total.bottom.toFixed(2)}`)).toBe(true);
    expect(total.path).toContain('Q');
    const down = bar('cogsVariable');
    expect(down.path.startsWith(`M${down.x.toFixed(2)} ${down.top.toFixed(2)}`)).toBe(true);
  });

  it('tháng lỗ: cột tổng âm đi dưới trục 0, tông cost, nhãn dưới có dấu trừ', () => {
    const loss = waterfallView(lossMonthReport);
    if (!loss) throw new Error('tháng lỗ phải có thác nước');
    const gross = loss.bars.find((b) => b.key === 'grossProfit');
    const net = loss.bars.find((b) => b.key === 'netProfit');
    const base = loss.grid.find((g) => g.base);
    expect(gross?.tone).toBe('cost');
    expect(net?.tone).toBe('cost');
    expect(gross?.top).toBeCloseTo(base?.y ?? Number.NaN, 2);
    expect(net?.top).toBeCloseTo(base?.y ?? Number.NaN, 2);
    expect(net?.label.text).toBe(`${MINUS}$1.2k`);
    expect(net?.label.y).toBeCloseTo((net?.bottom ?? 0) + 11, 2);
  });

  it('nhãn dưới không bao giờ chạm hàng nhãn hạng mục (chân chữ ≤ 198)', () => {
    for (const report of [septemberReport, lossMonthReport]) {
      const v = waterfallView(report);
      for (const b of v?.bars ?? []) {
        if (b.label.y > b.bottom) expect(b.label.y).toBeLessThanOrEqual(198 + 1e-9);
      }
    }
    // Lãi ròng sát 0: đáy cột phí gần trục, tỉ lệ phải co lại cho nhãn của nó.
    const thin = waterfallView({ ...septemberReport, paymentFees: '9006.60', netProfit: '10.00' });
    const fees = thin?.bars.find((b) => b.key === 'paymentFees');
    expect(fees?.label.y).toBeLessThanOrEqual(198 + 1e-9);
  });

  it('cột bằng 0 vẫn thấy được: cao 1.5, nhãn $0, vẫn treo ở mức đang chạy', () => {
    const loss = waterfallView(lossMonthReport);
    const gross = loss?.bars.find((b) => b.key === 'grossProfit');
    const tax = loss?.bars.find((b) => b.key === 'taxAmount');
    expect((tax?.bottom ?? 0) - (tax?.top ?? 0)).toBeCloseTo(1.5, 2);
    expect(tax?.top).toBeCloseTo(gross?.bottom ?? Number.NaN, 2);
    expect(tax?.label.text).toBe('$0');
    // Cột tổng bằng 0 nới LÊN: chân vẫn bám trục.
    const flat = waterfallView({
      ...lossMonthReport,
      recognizedRevenue: '0.00',
      cogsVariable: '6000.00',
    });
    const recognized = flat?.bars.find((b) => b.key === 'recognizedRevenue');
    expect(recognized?.bottom).toBeCloseTo(flat?.grid.find((g) => g.base)?.y ?? Number.NaN, 2);
    expect((recognized?.bottom ?? 0) - (recognized?.top ?? 0)).toBeCloseTo(1.5, 2);
  });

  it('cả bảy giá trị bằng 0 thì không vẽ', () => {
    expect(waterfallView(emptyMonthReport)).toBeNull();
  });
});

describe('statusBarView — thanh 100% trạng thái', () => {
  it('chỉ trạng thái khác 0, theo thứ tự Paid trước Cancelled cuối; rộng cộng khe đúng 600', () => {
    const bar = statusBarView(septemberReport);
    expect(bar?.segments.map((s) => [s.status, s.tone])).toEqual([
      ['PAID', 'gain'],
      ['CANCELLED', 'cost'],
    ]);
    const [paid, cancelled] = bar?.segments ?? [];
    expect(paid?.x).toBe(0);
    expect(paid?.width).toBeCloseTo((65 / 71) * 598, 2);
    expect(cancelled?.x).toBeCloseTo((paid?.width ?? 0) + 2, 2);
    expect((cancelled?.x ?? 0) + (cancelled?.width ?? 0)).toBeCloseTo(600, 2);
  });

  it('đủ năm trạng thái: thứ tự và tông cố định, không theo thứ tự của API', () => {
    const bar = statusBarView({
      ...septemberReport,
      newBookings: 400,
      bookingsByStatus: [
        { status: 'PENDING', count: 20 },
        { status: 'PAID', count: 300 },
        { status: 'CANCELLED', count: 60 },
        { status: 'REFUNDED', count: 1 },
        { status: 'PARTIALLY_REFUNDED', count: 19 },
      ],
    });
    expect(bar?.segments.map((s) => [s.status, s.tone])).toEqual([
      ['PAID', 'gain'],
      ['PARTIALLY_REFUNDED', 'partial'],
      ['PENDING', 'pending'],
      ['REFUNDED', 'refunded'],
      ['CANCELLED', 'cost'],
    ]);
    expect(bar?.legend.map((l) => [l.label, l.count, l.share])).toEqual([
      ['Paid', '300', '75%'],
      ['Partially refunded', '19', '5%'],
      ['Pending', '20', '5%'],
      ['Refunded', '1', '<1%'],
      ['Cancelled', '60', '15%'],
    ]);
    expect(bar?.total).toBe('400');
  });

  it('chú thích tháng 9: phần trăm làm tròn số nguyên', () => {
    expect(statusBarView(septemberReport)?.legend.map((l) => l.share)).toEqual(['92%', '8%']);
  });

  it('chưa đủ trăm mà tròn ra 100 thì ">99%" — không để "100%" đứng cạnh một trạng thái khác', () => {
    const bar = statusBarView({
      ...septemberReport,
      newBookings: 400,
      bookingsByStatus: [
        { status: 'PENDING', count: 0 },
        { status: 'PAID', count: 399 },
        { status: 'CANCELLED', count: 1 },
        { status: 'REFUNDED', count: 0 },
        { status: 'PARTIALLY_REFUNDED', count: 0 },
      ],
    });
    expect(bar?.legend.map((l) => l.share)).toEqual(['>99%', '<1%']);
  });

  it('không booking nào thì không có thanh', () => {
    expect(
      statusBarView({
        ...septemberReport,
        newBookings: 0,
        bookingsByStatus: septemberReport.bookingsByStatus.map((s) => ({ ...s, count: 0 })),
      }),
    ).toBeNull();
  });
});

describe('reportPrintView — chữ và số của tờ in', () => {
  const t = messages.admin.reports;
  const view = reportPrintView(septemberReport);

  it('đầu trang, tiêu đề, dòng kỳ', () => {
    expect(view.docNumber).toBe('2026-09');
    expect(view.meta).toBe('Generated 10 Oct 2026, 02:30 UTC');
    expect(view.title).toBe('Monthly report — September 2026');
    expect(view.periodLine).toBe(
      '1 Sep 2026 – 30 Sep 2026 · all amounts in USD · tax on margin 10.0%',
    );
    expect(view.footerRef).toBe('Monthly report 2026-09');
  });

  it('tháng chưa bắt đầu: dòng kỳ nói thẳng', () => {
    expect(reportPrintView(emptyMonthReport).periodLine).toBe(
      'Not started yet · all amounts in USD · tax on margin 10.0%',
    );
  });

  it('bốn ô số theo spec §5.1, ô đầu nền nhạt', () => {
    expect(view.tiles.map((tile) => [tile.label, tile.value, tile.caption, tile.hero])).toEqual([
      [t.cards.recognizedRevenue, '$39,607.80', t.cards.recognizedCaption, true],
      [t.cards.grossProfit, '$9,918.26', 'Gross margin 25.0%', false],
      [t.cards.netProfit, '$8,080.84', t.cards.netCaption, false],
      [t.cards.revenue, '$31,543.39', '70 paid bookings', false],
    ]);
    expect(view.tiles.some((tile) => tile.long)).toBe(false);
  });

  it('số dài hạ cỡ chữ; biên gộp không xác định in gạch', () => {
    const big = reportPrintView({ ...septemberReport, revenue: '1234567.89' });
    expect(big.tiles.map((tile) => tile.long)).toEqual([false, false, false, true]);
    expect(reportPrintView(emptyMonthReport).tiles[1]?.caption).toBe('Gross margin —');
  });

  it('bảng lãi lỗ kế toán: chi phí trong ngoặc, dòng cộng và lãi ròng có gạch', () => {
    expect(view.pnl.map((row) => [row.key, row.value, row.indent, row.rule])).toEqual([
      ['recognizedRevenue', '39,607.80', false, 'none'],
      ['cogsVariable', '(25,737.54)', true, 'none'],
      ['cogsFixed', '(3,952.00)', true, 'none'],
      ['cogsTotal', '(29,689.54)', false, 'sub'],
      ['grossProfit', '9,918.26', false, 'sub'],
      ['taxAmount', '(901.66)', true, 'none'],
      ['paymentFees', '(935.76)', true, 'none'],
      ['netProfit', '8,080.84', false, 'net'],
    ]);
    expect(view.pnl[5]?.label).toBe('Tax on margin (10.0%)');
    expect(view.departuresNote).toBe('15 departures ran this month');
  });

  it('tháng lỗ: lãi âm trong ngoặc, không thành số dương', () => {
    const loss = reportPrintView(lossMonthReport);
    expect(loss.pnl.find((row) => row.key === 'grossProfit')?.value).toBe('(1,000.00)');
    expect(loss.pnl.find((row) => row.key === 'netProfit')?.value).toBe('(1,150.00)');
  });

  it('cảnh báo giá vốn chỉ có khi thiếu dữ liệu', () => {
    expect(view.costWarning).toBeNull();
    expect(reportPrintView({ ...septemberReport, costDataMissing: 12 }).costWarning).toBe(
      t.pnlTable.costMissing('12'),
    );
  });

  it('tám chỉ số vận hành của bảng màn hình', () => {
    expect(view.ops.map((row) => [row.label, row.value])).toEqual([
      [t.operationsTable.revenue, '$31,543.39'],
      [t.operationsTable.paidBookings, '70'],
      [t.operationsTable.newBookings, '71'],
      [t.operationsTable.refundedTotal, '$1,826.00'],
      [t.operationsTable.refunds, '6'],
      [t.operationsTable.cancellationsWithinDeadline, '4'],
      [t.operationsTable.cancellationsAfterDeadline, '2'],
      [t.operationsTable.reviewsApproved, '10'],
    ]);
  });

  it('bảy chú giải theo thứ tự sheet Definitions của file Excel', () => {
    const d = t.definitions;
    expect(view.definitions).toEqual([
      d.revenue,
      d.recognised,
      d.costs,
      d.netProfit,
      d.refunds,
      d.statuses,
      d.cancellations,
    ]);
  });

  it('thác nước và thanh trạng thái đi theo hai hàm hình học', () => {
    expect(view.waterfall).toEqual(waterfallView(septemberReport));
    expect(view.statusBar).toEqual(statusBarView(septemberReport));
    expect(reportPrintView(emptyMonthReport).waterfall).toBeNull();
  });
});
