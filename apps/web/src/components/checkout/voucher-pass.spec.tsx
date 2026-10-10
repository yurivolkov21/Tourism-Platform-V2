import { render, screen, within } from '@testing-library/react';
import type { BookingDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { ticketBarcodeWidths } from '@/lib/checkout';
import { voucherView } from '@/lib/voucher';
import { makeCancellation } from '@/test/fixtures/booking';
import {
  CANCELLED_AFTER_PAYING,
  THREE_DAY_TRIP,
  VOUCHER_NOW,
  voucherBooking,
  voucherNowOn,
} from '@/test/fixtures/voucher';
import { VoucherPass } from './voucher-pass';

const CODE = 'BK-B6VCOQNW';

/** 2 người lớn + 1 trẻ em: "Admit 3" khác hẳn số người lớn, và có hai dòng tiền. */
const FAMILY = { numAdults: 2, numChildren: 1 };

/** Chuyến ba ngày 3–5/11 đã qua hạn huỷ và đã tới ngày đi (hết nút huỷ) — dùng cho ca đã đi. */
const THREE_DAYS_PASSED = {
  ...THREE_DAY_TRIP,
  cancellation: makeCancellation(voucherBooking(THREE_DAY_TRIP), {
    withinDeadline: false,
    canCancel: false,
  }),
};

function renderPass(overrides: Partial<BookingDetail> = {}, now = VOUCHER_NOW) {
  const booking = voucherBooking(overrides);
  const view = voucherView(booking, now);
  if (view === null) throw new Error('fixture phải là đơn đã trả');
  return render(<VoucherPass booking={booking} view={view} />);
}

function slot(container: HTMLElement, name: string): HTMLElement {
  const el = container.querySelector<HTMLElement>(`[data-slot="${name}"]`);
  if (!el) throw new Error(`thiếu [data-slot="${name}"]`);
  return el;
}

function texts(elements: Iterable<Element>): (string | null)[] {
  return [...elements].map((el) => el.textContent);
}

describe('VoucherPass — khối mã (sắp đi)', () => {
  it('ô mã có nút chép; ngày đi và "Admit {tổng khách}"', () => {
    const { container } = renderPass(FAMILY);
    const ticket = within(slot(container, 'voucher-ticket'));
    expect(ticket.getByText(CODE)).toBeInTheDocument();
    expect(
      ticket.getByRole('button', { name: messages.booking.success.copyCode }),
    ).toBeInTheDocument();
    const meta = within(slot(container, 'voucher-meta'));
    expect(meta.getByText('3 Nov 2026')).toBeInTheDocument();
    expect(meta.getByText('Admit 3')).toBeInTheDocument();
  });

  it('ba dòng điều kiện đúng thứ tự bảng §2.6, mỗi dòng một dấu tích', () => {
    const { container } = renderPass();
    const items = slot(container, 'voucher-conditions').querySelectorAll('li');
    expect(texts(items)).toEqual([
      'Show this code at pickup — printed or on your phone.',
      'Free cancellation until 2 Nov, 11:59 pm Vietnam time. No refund after that.',
      'Includes all taxes and fees.',
    ]);
    for (const item of items) expect(item.querySelector('svg')).not.toBeNull();
  });

  it('mã vạch tất định theo mã đơn, ẩn khỏi trình đọc màn hình', () => {
    const { container } = renderPass();
    const barcode = slot(container, 'barcode');
    const widths = ticketBarcodeWidths(CODE);
    expect(barcode).toHaveAttribute('aria-hidden', 'true');
    const bars = [...barcode.querySelectorAll('span')];
    expect(bars.map((bar) => bar.style.width)).toEqual(widths.map((w) => `${w}px`));
  });

  // `voucher-stack:` (globals.css) là thẻ một cột — màn hình dưới xl; bản cũ
  // tự ghép cặp `max-xl:hidden print:flex` ở nơi gọi (review P7C#13).
  it('ô mã giấu khi thẻ một cột (dưới xl — cột trái có ô gọn)', () => {
    const { container } = renderPass();
    const code = slot(container, 'voucher-code');
    expect(code.classList.contains('voucher-stack:hidden')).toBe(true);
    // Ngày, điều kiện và mã vạch vẫn cần khi thẻ một cột: khối KHÔNG giấu.
    expect(slot(container, 'voucher-ticket').classList.contains('voucher-stack:hidden')).toBe(
      false,
    );
  });
});

describe('VoucherPass — theo giai đoạn', () => {
  it('đã đi: còn mã, KHÔNG mã vạch, chỉ còn dòng giá đã gồm thuế phí', () => {
    const { container } = renderPass(THREE_DAYS_PASSED, voucherNowOn('2026-11-10'));
    expect(screen.getByText(CODE)).toBeInTheDocument();
    expect(container.querySelector('[data-slot="barcode"]')).toBeNull();
    expect(texts(slot(container, 'voucher-conditions').querySelectorAll('li'))).toEqual([
      'Includes all taxes and fees.',
    ]);
  });

  it('đã huỷ: không mã, không Admit, không mã vạch — dải hết hiệu lực; khối giấu khi thẻ một cột', () => {
    const { container } = renderPass(CANCELLED_AFTER_PAYING);
    expect(screen.queryByText(CODE)).toBeNull();
    expect(screen.queryByText('Admit 3')).toBeNull();
    expect(container.querySelector('[data-slot="barcode"]')).toBeNull();
    const ticket = slot(container, 'voucher-ticket');
    expect(ticket.textContent).toBe(
      'This booking was cancelled — this voucher is no longer valid.',
    );
    // Cột trái đã nói điều này khi thẻ một cột; thẻ chia đôi thì có.
    expect(ticket.classList.contains('voucher-stack:hidden')).toBe(true);
  });
});

describe('VoucherPass — Receipt overview', () => {
  it('các dòng tiền của bookingPriceLines rồi "Total paid"', () => {
    const { container } = renderPass(FAMILY);
    const receipt = slot(container, 'voucher-receipt');
    expect(
      within(receipt).getByRole('heading', { level: 3, name: 'Receipt overview' }),
    ).toBeInTheDocument();
    expect(texts(receipt.querySelectorAll('dt'))).toEqual(['2 adults', '1 child', 'Total paid']);
    expect(texts(receipt.querySelectorAll('dd'))).toEqual(['$98', '$49', '$147']);
  });

  /**
   * Tiền hoàn luôn đủ hai số lẻ (đối chiếu sao kê), nên có dòng Refunded thì cả khối theo nó: đơn giá
   * chẵn in "$147" trên "−$73.50" là hai độ chính xác trong cùng một cột (thử tay prod 09/10).
   */
  it('PARTIALLY_REFUNDED: thêm "Refunded −{số tiền}", cả khối đủ hai số lẻ cho thẳng cột', () => {
    const { container } = renderPass({ status: 'PARTIALLY_REFUNDED', refundedTotal: '73.50' });
    const receipt = slot(container, 'voucher-receipt');
    expect(texts(receipt.querySelectorAll('dt'))).toEqual(['3 adults', 'Total paid', 'Refunded']);
    // Dấu trừ U+2212, không phải gạch nối.
    expect(texts(receipt.querySelectorAll('dd'))).toEqual(['$147.00', '$147.00', '−$73.50']);
  });

  it('REFUNDED trọn trên đơn giá chẵn: tổng và tiền hoàn cùng hai số lẻ', () => {
    const { container } = renderPass({ status: 'REFUNDED', refundedTotal: '147.00' });
    expect(texts(slot(container, 'voucher-receipt').querySelectorAll('dd'))).toEqual([
      '$147.00',
      '$147.00',
      '−$147.00',
    ]);
  });

  it('chưa hoàn đồng nào (refundedTotal 0.00) thì không có dòng Refunded', () => {
    const { container } = renderPass();
    expect(within(slot(container, 'voucher-receipt')).queryByText('Refunded')).toBeNull();
  });
});

describe('VoucherPass — Trip journal', () => {
  it('ba mốc đúng thứ tự; mốc đã xong mang dấu "Done" cho trình đọc màn hình, mốc chưa tới thì không', () => {
    const { container } = renderPass();
    const journal = slot(container, 'voucher-journal');
    expect(
      within(journal).getByRole('heading', { level: 3, name: 'Trip journal' }),
    ).toBeInTheDocument();
    const items = [...journal.querySelectorAll('li')];
    expect(items.map((li) => li.querySelector('p')?.textContent)).toEqual([
      'Booked and paid',
      'Free cancellation ends',
      'Pickup day',
    ]);
    const [booked, cancelEnds, pickup] = items;
    if (!booked || !cancelEnds || !pickup) throw new Error('nhật ký phải có ba mốc');
    expect(within(booked).getByRole('img', { name: 'Done' })).toBeInTheDocument();
    expect(within(booked).getByText('18 Oct 2026 · PayPal')).toBeInTheDocument();
    expect(within(cancelEnds).queryByRole('img', { name: 'Done' })).toBeNull();
    expect(within(pickup).queryByRole('img', { name: 'Done' })).toBeNull();
  });

  /**
   * Vạch nối giữa hai mốc phải IN được (review P7C#11): bản cũ vẽ bằng nền của `::before` — trình
   * duyệt mặc định không in nền, và quy tắc in của mảng teal (`[data-slot="voucher-pass"] *`) không
   * khớp giả phần tử — nên giấy mất cả đường thời gian. Vạch là một phần tử thật, ẩn với trình đọc
   * màn hình; mốc cuối không có vạch.
   */
  it('vạch nối giữa hai mốc là phần tử thật (in được), mốc cuối không có', () => {
    const { container } = renderPass();
    const items = [...slot(container, 'voucher-journal').querySelectorAll('li')];
    const lines = items.map((li) => li.querySelector('[data-slot="journal-line"]'));
    expect(lines.map((line) => line !== null)).toEqual([true, true, false]);
    for (const line of lines) if (line) expect(line).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('VoucherPass — lối đi tiếp', () => {
  it('"View booking" tới trang chi tiết đơn, "Browse more tours" tới /tours', () => {
    renderPass();
    const viewBooking = screen.getByRole('link', { name: messages.booking.success.viewBooking });
    expect(viewBooking).toHaveAttribute('href', `/account/bookings/${CODE}`);
    const browse = screen.getByRole('link', { name: messages.booking.success.viewTours });
    expect(browse).toHaveAttribute('href', '/tours');
  });

  // Nút của hệ (`ButtonLink` — `data-slot="button"`, cùng vòng focus, cỡ chữ, khoá chọn chữ như
  // mọi CTA điều hướng), không phải một `Link` tự dựng lại kiểu nút (review P7C mục 22).
  it('"View booking" là ButtonLink của hệ — link thật, kiểu nút', () => {
    renderPass();
    const viewBooking = screen.getByRole('link', { name: messages.booking.success.viewBooking });
    expect(viewBooking).toHaveAttribute('data-slot', 'button');
  });
});
