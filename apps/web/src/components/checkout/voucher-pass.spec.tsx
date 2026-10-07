import { render, screen, within } from '@testing-library/react';
import type { BookingCancellation, BookingDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { ticketBarcodeWidths } from '@/lib/checkout';
import { voucherView } from '@/lib/voucher';
import { VOUCHER_NOW, VOUCHER_TODAY, voucherBooking } from '@/test/fixtures/voucher';
import { VoucherPass } from './voucher-pass';

const CODE = 'BK-B6VCOQNW';

/** 2 người lớn + 1 trẻ em: "Admit 3" khác hẳn số người lớn, và có hai dòng tiền. */
const FAMILY = { numAdults: 2, numChildren: 1 };

/** Chuyến ba ngày 3–5/11 đã qua hạn huỷ — dùng cho ca đã đi. */
const PASSED: BookingCancellation = {
  deadline: '2026-10-31',
  withinDeadline: false,
  refundAmount: '0.00',
  canCancel: false,
};
const THREE_DAYS_PASSED = {
  departureStartDate: '2026-11-03',
  departureEndDate: '2026-11-05',
  cancellationDeadline: '2026-10-31',
  cancellation: PASSED,
};

function renderPass(overrides: Partial<BookingDetail> = {}, today = VOUCHER_TODAY) {
  const booking = voucherBooking(overrides);
  const view = voucherView(booking, VOUCHER_NOW, today);
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

  it('ô mã giấu trên điện thoại (cột trái có ô gọn) nhưng hiện lại khi in', () => {
    const { container } = renderPass();
    const code = slot(container, 'voucher-code');
    expect(code.classList.contains('max-md:hidden')).toBe(true);
    expect(code.classList.contains('print:flex')).toBe(true);
    // Ngày, điều kiện và mã vạch vẫn cần trên điện thoại: khối KHÔNG giấu.
    expect(slot(container, 'voucher-ticket').classList.contains('max-md:hidden')).toBe(false);
  });
});

describe('VoucherPass — theo giai đoạn', () => {
  it('đã đi: còn mã, KHÔNG mã vạch, chỉ còn dòng giá đã gồm thuế phí', () => {
    const { container } = renderPass(THREE_DAYS_PASSED, '2026-11-10');
    expect(screen.getByText(CODE)).toBeInTheDocument();
    expect(container.querySelector('[data-slot="barcode"]')).toBeNull();
    expect(texts(slot(container, 'voucher-conditions').querySelectorAll('li'))).toEqual([
      'Includes all taxes and fees.',
    ]);
  });

  it('đã huỷ: không mã, không Admit, không mã vạch — dải hết hiệu lực; khối giấu trên điện thoại', () => {
    const { container } = renderPass({
      status: 'CANCELLED',
      cancellation: null,
      cancelledAt: '2026-10-19T08:00:00.000Z',
    });
    expect(screen.queryByText(CODE)).toBeNull();
    expect(screen.queryByText('Admit 3')).toBeNull();
    expect(container.querySelector('[data-slot="barcode"]')).toBeNull();
    const ticket = slot(container, 'voucher-ticket');
    expect(ticket.textContent).toBe(
      'This booking was cancelled — this voucher is no longer valid.',
    );
    // Cột trái đã nói điều này trên điện thoại; khi in thì hiện lại.
    expect(ticket.classList.contains('max-md:hidden')).toBe(true);
    expect(ticket.classList.contains('print:block')).toBe(true);
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

  it('PARTIALLY_REFUNDED: thêm "Refunded −{số tiền}" giữ đủ hai số lẻ', () => {
    const { container } = renderPass({ status: 'PARTIALLY_REFUNDED', refundedTotal: '73.50' });
    const receipt = slot(container, 'voucher-receipt');
    expect(texts(receipt.querySelectorAll('dt'))).toEqual(['3 adults', 'Total paid', 'Refunded']);
    // Dấu trừ U+2212, không phải gạch nối.
    expect(texts(receipt.querySelectorAll('dd'))).toEqual(['$147', '$147', '−$73.50']);
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
});

describe('VoucherPass — lối đi tiếp', () => {
  it('"View booking" tới trang chi tiết đơn, "Browse more tours" tới /tours; cả hai giấu khi in', () => {
    renderPass();
    const viewBooking = screen.getByRole('link', { name: messages.booking.success.viewBooking });
    expect(viewBooking).toHaveAttribute('href', `/account/bookings/${CODE}`);
    const browse = screen.getByRole('link', { name: messages.booking.success.viewTours });
    expect(browse).toHaveAttribute('href', '/tours');
    expect(viewBooking.classList.contains('print:hidden')).toBe(true);
    expect(browse.classList.contains('print:hidden')).toBe(true);
  });
});
