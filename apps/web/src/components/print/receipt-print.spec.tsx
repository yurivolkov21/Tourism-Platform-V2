import { render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { receiptPrintView } from '@/lib/print/receipt-print';
import { EMAIL, PHONE } from '@/lib/site';
import { makeBooking } from '@/test/fixtures/booking';
import { ReceiptPrint } from './receipt-print';

const r = messages.printDoc.receipt;

function renderReceipt() {
  const booking = makeBooking({
    status: 'PENDING',
    paidAt: null,
    createdAt: '2026-10-09T10:59:36.812Z',
    departureStartDate: '2026-10-29',
    departureEndDate: '2026-10-29',
  });
  return render(
    <ReceiptPrint view={receiptPrintView(booking, new Date('2026-10-09T11:02:00Z'))} />,
  );
}

describe('ReceiptPrint', () => {
  // Giấy luôn sáng (ADR-0057 §5): `.light` chỉ đặt lại biến màu, còn biến thể `dark:` vẫn khớp mọi
  // con của `<html class="dark">`. Linh kiện mang `dark:` lọt vào tài liệu in là in nền tối lên giấy
  // sáng khi khách in từ giao diện tối — chặn ở đây, mọi tài liệu in dùng lại luật này.
  it('không class `dark:` nào trong tài liệu in', () => {
    const { container } = renderReceipt();
    const classes = [...container.querySelectorAll('[class]')].flatMap((el) => [...el.classList]);
    expect(classes.filter((cls) => cls.startsWith('dark:'))).toEqual([]);
  });

  it('là tài liệu in: data-print-doc, ẩn trên màn hình', () => {
    const { container } = renderReceipt();
    const doc = container.querySelector('[data-print-doc]');
    expect(doc?.classList.contains('hidden')).toBe(true);
    expect(doc?.classList.contains('print:flex')).toBe(true);
  });

  it('đủ khối của B1: bìa 22 pt, vé chờ, dòng xé, bảng tiền, dải ba cột đều', () => {
    const { container } = renderReceipt();
    expect(screen.getByText(r.docType)).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 }).className).toContain('text-[22pt]');
    expect(container.querySelector('[data-slot="print-ticket"]')).toHaveAttribute(
      'data-tone',
      'pending',
    );
    expect(screen.getByText(messages.booking.success.stubNotYetVoucher)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: r.summary })).toBeInTheDocument();
    for (const header of [
      r.columns.item,
      messages.passportVisa.labels.travellers,
      r.columns.price,
      r.columns.amount,
    ]) {
      expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument();
    }
    expect(container.querySelector('[data-slot="print-band"]')?.className).toContain('grid-cols-3');
    expect(screen.getByText(r.howToPay)).toBeInTheDocument();
  });

  it('chân trang hoá đơn có cả email đậm lẫn điện thoại', () => {
    const { container } = renderReceipt();
    const footer = container.querySelector('[data-slot="doc-footer"]');
    expect(footer).toHaveTextContent(
      `${messages.booking.success.needHelp} ${messages.printDoc.writeTo} ${EMAIL} · ${PHONE}`,
    );
    expect(footer?.querySelector('b')).toHaveTextContent(EMAIL);
  });
});
