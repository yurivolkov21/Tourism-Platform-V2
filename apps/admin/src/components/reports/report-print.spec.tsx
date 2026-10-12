import { render, screen, within } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { reportPrintView } from '@/lib/report-print';
import { emptyMonthReport, lossMonthReport, septemberReport } from '@/test/monthly-report';
import { ReportPrint } from './report-print';

const t = messages.admin.reports;

function renderReport(report = septemberReport) {
  return render(<ReportPrint view={reportPrintView(report)} />);
}

describe('ReportPrint — tờ in báo cáo tháng C2', () => {
  // Giấy luôn sáng (ADR-0057 §5): `.light` chỉ đặt lại biến màu, biến thể `dark:` vẫn khớp mọi con
  // của `<html class="dark">` — cùng luật canh của voucher và hoá đơn chờ bên web.
  it('không class `dark:` nào trong tài liệu in', () => {
    const { container } = renderReport();
    const classes = [...container.querySelectorAll('[class]')].flatMap((el) => [
      ...(el.getAttribute('class')?.split(/\s+/) ?? []),
    ]);
    expect(classes.filter((cls) => cls.startsWith('dark:'))).toEqual([]);
  });

  it('là tài liệu in: data-print-doc, ẩn trên màn hình, hiện khi in', () => {
    const { container } = renderReport();
    const doc = container.querySelector('[data-print-doc]');
    expect(doc?.classList.contains('hidden')).toBe(true);
    expect(doc?.classList.contains('print:flex')).toBe(true);
  });

  it('đầu trang nội bộ: loại, kỳ, mốc tạo, dòng liên hệ back office', () => {
    const { container } = renderReport();
    const head = container.querySelector('[data-slot="doc-letterhead"]') as HTMLElement;
    expect(within(head).getByText(t.title)).toBeInTheDocument();
    expect(within(head).getByText('2026-09')).toBeInTheDocument();
    expect(within(head).getByText('Generated 10 Oct 2026, 02:30 UTC')).toBeInTheDocument();
    expect(within(head).getByText('Back office · www.nexora-travel.agency')).toBeInTheDocument();
  });

  it('tiêu đề tờ là h2, bốn khối là h3 theo thứ tự của bản thảo', () => {
    renderReport();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      'Monthly report — September 2026',
    );
    expect(screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual([
      t.waterfallHeading,
      t.bookingsTable.heading,
      t.operationsTable.heading,
      t.definitions.heading,
    ]);
  });

  it('bốn ô số, ô đầu nền paper; số dài hạ cỡ chữ', () => {
    const { container } = renderReport({ ...septemberReport, revenue: '1234567.89' });
    const tiles = container.querySelectorAll('[data-slot="report-tiles"] > div');
    expect(tiles).toHaveLength(4);
    expect(tiles[0]?.className).toContain('bg-paper');
    expect(tiles[1]?.className).not.toContain('bg-paper');
    expect(within(tiles[3] as HTMLElement).getByText('$1,234,567.89').className).toContain(
      'text-[12pt]',
    );
  });

  it('thác nước: SVG có nhãn cho máy đọc, bảy cột, cột chi phí mang vân 45°', () => {
    const { container } = renderReport();
    const chart = screen.getByRole('img', { name: 'Profit and loss waterfall, September 2026' });
    const bars = chart.querySelectorAll('[data-slot="waterfall-bar"]');
    expect(bars).toHaveLength(7);
    const hatch = container.querySelector('pattern');
    expect(hatch?.getAttribute('patternTransform')).toBe('rotate(45)');
    const hatchId = hatch?.getAttribute('id');
    for (const bar of bars) {
      const hatched = bar.querySelector(`path[fill="url(#${hatchId})"]`) !== null;
      expect(hatched).toBe(bar.getAttribute('data-tone') === 'cost');
    }
    expect(within(chart).getByText('$39.6k')).toBeInTheDocument();
  });

  it('tháng chưa có số: câu thay cho biểu đồ, bảng lãi lỗ vẫn in số 0', () => {
    const { container } = renderReport(emptyMonthReport);
    expect(screen.queryByRole('img')).toBeNull();
    expect(screen.getByText(t.printDoc.noFigures)).toBeInTheDocument();
    const rows = container.querySelectorAll('[data-slot="report-pnl"] tbody tr');
    expect(rows).toHaveLength(8);
    for (const row of rows) expect(row.lastElementChild?.textContent).toBe('0.00');
  });

  it('bảng lãi lỗ: lãi ròng gạch kép dưới, dòng chú thích số chuyến', () => {
    const { container } = renderReport(lossMonthReport);
    const net = container.querySelector('[data-slot="report-pnl"] tr[data-key="netProfit"]');
    expect(net?.lastElementChild?.textContent).toBe('(1,150.00)');
    expect(net?.lastElementChild?.className).toContain('border-double');
    expect(screen.getByText('15 departures ran this month')).toBeInTheDocument();
  });

  it('cảnh báo giá vốn chỉ hiện khi thiếu dữ liệu', () => {
    const { container, unmount } = renderReport();
    expect(container.querySelector('[data-slot="report-cost-warning"]')).toBeNull();
    unmount();
    renderReport({ ...septemberReport, costDataMissing: 12, departuresCostMissing: 2 });
    expect(screen.getByText(/12 bookings have no cost data/)).toBeInTheDocument();
  });

  it('thanh trạng thái: chú thích nhãn · số · %, tổng ở cuối; ô màu cùng vân với đoạn', () => {
    const { container } = renderReport({
      ...septemberReport,
      newBookings: 74,
      bookingsByStatus: [
        { status: 'PENDING', count: 3 },
        { status: 'PAID', count: 65 },
        { status: 'CANCELLED', count: 5 },
        { status: 'REFUNDED', count: 1 },
        { status: 'PARTIALLY_REFUNDED', count: 0 },
      ],
    });
    const block = container.querySelector('[data-slot="status-bar"]') as HTMLElement;
    const items = within(block).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      'Paid 65 (88%)',
      'Pending 3 (4%)',
      'Refunded 1 (1%)',
      'Cancelled 5 (7%)',
      'Total 74',
    ]);
    // Paid đặc; Pending vân ngang (in xám nó trùng tông Paid), Refunded vân 135°, Cancelled vân 45° —
    // ô màu dùng đúng pattern của đoạn trên thanh.
    const fills = (el: Element) =>
      [...el.querySelectorAll('rect[fill]')].map((rect) => rect.getAttribute('fill'));
    const hatches = [
      [],
      ['url(#report-print-status-hatch-90)'],
      ['url(#report-print-status-hatch-135)'],
      ['url(#report-print-status-hatch-45)'],
    ];
    expect(items.slice(0, 4).map(fills)).toEqual(hatches);
    expect([...block.querySelectorAll('svg > g[data-status]')].map(fills)).toEqual(hatches);
    for (const angle of ['45', '90', '135']) {
      const pattern = block.querySelector(`#report-print-status-hatch-${angle}`);
      expect(pattern?.getAttribute('patternTransform')).toBe(`rotate(${angle})`);
    }
  });

  it('không booking nào: câu trống thay cho thanh', () => {
    const { container } = renderReport({
      ...septemberReport,
      newBookings: 0,
      bookingsByStatus: septemberReport.bookingsByStatus.map((s) => ({ ...s, count: 0 })),
    });
    expect(container.querySelector('[data-slot="status-bar"]')).toBeNull();
    expect(screen.getByText(t.bookingsTable.empty)).toBeInTheDocument();
  });

  it('tám chỉ số vận hành và bảy chú giải đánh số', () => {
    const { container } = renderReport();
    expect(container.querySelectorAll('[data-slot="report-ops"] dt')).toHaveLength(8);
    const notes = container.querySelectorAll('[data-slot="report-definitions"] li');
    expect([...notes].map((li) => li.firstElementChild?.textContent)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '5',
      '6',
      '7',
    ]);
    expect(notes[0]?.textContent).toBe(`1${t.definitions.revenue}`);
  });

  it('chân trang nội bộ: back office · kỳ · không phát tán; giờ in bên phải', () => {
    const { container } = renderReport();
    const footer = container.querySelector('[data-slot="doc-footer"]');
    expect(footer?.firstElementChild?.textContent).toBe(
      'Nexora back office · Monthly report 2026-09 · Internal — not for distribution',
    );
    expect(footer?.querySelector('[data-slot="printed-at"]')).not.toBeNull();
  });

  // Bản thảo khai cỡ chữ bằng shorthand `font:` nên các dòng này dãn `normal`, không 1.45 của tờ; và
  // tailwind-merge xoá `leading-*` đứng trước một lớp cỡ chữ — test canh cả hai cái bẫy.
  it('nhịp chữ của bản thảo: nền 9pt dãn 1.45; tên khối, nhãn, số dãn normal', () => {
    const { container } = renderReport();
    const doc = container.querySelector('[data-print-doc]');
    expect(doc?.className).toContain('text-[9pt]');
    expect(doc?.className).toContain('leading-[1.45]');
    for (const h of screen.getAllByRole('heading', { level: 3 })) {
      expect(h.className).toContain('text-[10.5pt]');
      expect(h.className).toContain('leading-[normal]');
    }
    const value = screen.getByText('$39,607.80');
    expect(value.className).toContain('text-[15pt]');
    expect(value.className).toContain('leading-[normal]');
    const ops = container.querySelectorAll(
      '[data-slot="report-ops"] dt, [data-slot="report-ops"] dd',
    );
    for (const el of ops) expect(el.className).toContain('leading-[normal]');
  });

  // jsdom không dàn trang; Chromium đo phần co (plan G40 Phần 2, "Kết quả đo"). Test này canh hình
  // của cột: khoảng là phần tử riêng nằm giữa các khối, và không khối nào còn lề trên chồng lên nó.
  it('khoảng giữa các khối là phần tử co giãn: dài như bản thảo, co tới mức sàn', () => {
    const { container } = renderReport();
    const doc = container.querySelector('[data-print-doc]') as HTMLElement;
    expect(
      [...doc.children].map((el) => el.getAttribute('data-slot') ?? el.tagName.toLowerCase()),
    ).toEqual([
      'doc-letterhead',
      'report-gap',
      'h2',
      'p',
      'report-gap',
      'report-tiles',
      'report-gap',
      'report-waterfall',
      'report-gap',
      'report-bookings',
      'report-gap',
      'report-ops',
      'report-gap',
      'report-definitions',
      'doc-footer',
    ]);
    const gaps = doc.querySelectorAll(':scope > [data-slot="report-gap"]');
    expect([...gaps].map((gap) => gap.className)).toEqual([
      'shrink basis-[5mm] min-h-[3.5mm]',
      'shrink basis-[6mm] min-h-[4.5mm]',
      ...Array(4).fill('shrink basis-[5mm] min-h-[2.5mm]'),
    ]);
    for (const gap of gaps) expect(gap.getAttribute('aria-hidden')).toBe('true');
    const blocks = [
      screen.getByRole('heading', { level: 2 }),
      container.querySelector('[data-slot="report-tiles"]'),
      ...screen.getAllByRole('heading', { level: 3 }),
    ];
    for (const block of blocks) expect(block?.className).not.toMatch(/(^|\s)mt-/);
  });
});
