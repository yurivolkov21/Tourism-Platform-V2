import { render, screen } from '@testing-library/react';
import type { BookingDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { voucherPrintView } from '@/lib/print/voucher-print';
import { EMAIL } from '@/lib/site';
import { voucherView } from '@/lib/voucher';
import { makeTourData } from '@/test/fixtures/booking';
import { CANCELLED_AFTER_PAYING, VOUCHER_NOW, voucherBooking } from '@/test/fixtures/voucher';
import { VoucherPrint } from './voucher-print';

const p = messages.printDoc.voucher;

function renderPrint(overrides: Partial<BookingDetail> = {}) {
  const booking = voucherBooking(overrides);
  const view = voucherView(booking, VOUCHER_NOW);
  if (view === null) throw new Error('fixture phải là đơn đã trả');
  return render(
    <VoucherPrint view={voucherPrintView(booking, view, makeTourData(), VOUCHER_NOW)} />,
  );
}

/**
 * Khối cấp một của tờ giấy: `data-slot` của từng con trực tiếp, hay của con đầu tiên khi con trực
 * tiếp là `div` bọc lấy khoảng cách (vé). Khoảng trống không slot thì bỏ.
 */
const blocks = (container: HTMLElement) => {
  const doc = container.querySelector('[data-print-doc]');
  return [...(doc?.children ?? [])]
    .map(
      (el) =>
        el.getAttribute('data-slot') ?? el.firstElementChild?.getAttribute('data-slot') ?? null,
    )
    .filter((slot) => slot !== null);
};

describe('VoucherPrint', () => {
  // Một trang A4 với dữ liệu thật (spec §3.4): luật cắt đếm mục, nên mỗi mục còn bị kẹp số dòng —
  // đo 10/10 tour seed dài từng đẩy chân trang ra mép giấy (review G40).
  it('kẹp số dòng: mục lịch trình, mục gồm hai dòng', () => {
    const { container } = renderPrint();
    const stops = container.querySelectorAll('[data-slot="print-day"] li');
    expect(stops.length).toBeGreaterThan(0);
    for (const li of stops) expect(li.lastElementChild?.className).toContain('line-clamp-2');
    const items = container.querySelectorAll('[data-slot="print-lists"] li span.line-clamp-2');
    expect(items.length).toBeGreaterThan(0);
  });

  it('chuyến nhiều ngày: danh sách ngày không chừa cột giờ trống', () => {
    const { container } = renderPrint({
      departureStartDate: '2026-11-03',
      departureEndDate: '2026-11-05',
    });
    const first = container.querySelector('[data-slot="print-day"] li');
    expect(first?.className).toContain('grid-cols-[3mm_1fr]');
    expect(first?.querySelector('time')).toBeNull();
  });

  // Giấy luôn sáng (ADR-0057 §5): `.light` chỉ đặt lại biến màu, còn biến thể `dark:` vẫn khớp mọi
  // con của `<html class="dark">`. Linh kiện mang `dark:` lọt vào tài liệu in là in nền tối lên giấy
  // sáng khi khách in từ giao diện tối — chặn ở đây, mọi tài liệu in dùng lại luật này.
  it('không class `dark:` nào trong tài liệu in', () => {
    const { container } = renderPrint();
    const classes = [...container.querySelectorAll('[class]')].flatMap((el) => [...el.classList]);
    expect(classes.filter((cls) => cls.startsWith('dark:'))).toEqual([]);
  });

  it('là tài liệu in: data-print-doc, ẩn trên màn hình, hiện khi in', () => {
    const { container } = renderPrint();
    const doc = container.querySelector('[data-print-doc]');
    expect(doc).not.toBeNull();
    expect(doc?.classList.contains('hidden')).toBe(true);
    expect(doc?.classList.contains('print:flex')).toBe(true);
  });

  it('đủ khối của 5b theo thứ tự: bìa, vé, dòng xé, lịch trình, mục gồm, dải, chân trang', () => {
    const { container } = renderPrint();
    expect(blocks(container)).toEqual([
      'print-cover',
      'print-ticket',
      'print-tear',
      'print-day',
      'print-lists',
      'print-band',
      'doc-footer',
    ]);
    expect(screen.getByText(p.docType)).toBeInTheDocument();
    expect(screen.getByText(p.included)).toBeInTheDocument();
    expect(screen.getByText(p.whereToMeet)).toBeInTheDocument();
  });

  it('chân trang: câu hỗ trợ có email đậm, giờ in đóng dấu ở client', () => {
    const { container } = renderPrint();
    const footer = container.querySelector('[data-slot="doc-footer"]');
    expect(footer).toHaveTextContent(
      `${messages.voucher.needHelp} ${messages.printDoc.replyOrWriteTo} ${EMAIL}`,
    );
    expect(footer?.querySelector('b')).toHaveTextContent(EMAIL);
    expect(footer?.querySelector('[data-slot="printed-at"]')?.textContent).toMatch(
      new RegExp(`^${messages.printDoc.printedPrefix} `),
    );
  });

  it('tên tour là h2 — trang chỉ một h1 (ContentHero); tên dài thì cỡ nhỏ', () => {
    const { container } = renderPrint();
    expect(container.querySelector('h1')).toBeNull();
    const title = screen.getByRole('heading', { level: 2 });
    expect(title).toHaveTextContent('Hanoi Heritage in a Day');
    expect(title.className).toContain('text-[27pt]');
  });

  it('tên dài hơn ngưỡng: bìa cỡ 22 pt', () => {
    const { container } = renderPrint({ tourTitle: 'A'.repeat(60) });
    expect(container.querySelector('h2')?.className).toContain('text-[22pt]');
  });

  it('đã huỷ: không dòng xé, không lịch trình, không mục gồm', () => {
    const { container } = renderPrint(CANCELLED_AFTER_PAYING);
    expect(container.querySelector('[data-slot="print-tear"]')).toBeNull();
    expect(container.querySelector('[data-slot="print-day"]')).toBeNull();
    expect(container.querySelector('[data-slot="print-lists"]')).toBeNull();
  });
});
