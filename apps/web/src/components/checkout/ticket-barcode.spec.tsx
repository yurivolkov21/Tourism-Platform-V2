import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ticketBarcodeWidths } from '@/lib/checkout';
import { TicketBarcode } from './ticket-barcode';

/**
 * Mã vạch trang trí của cuống hoá đơn, vé trang chi tiết đơn và voucher — MỘT bản vẽ thay ba bản
 * chép (review P7 B13, C#15).
 */
describe('TicketBarcode', () => {
  const CODE = 'BK-B6VCOQNW';

  function barcodeOf(container: HTMLElement): HTMLElement {
    const el = container.querySelector<HTMLElement>('[data-slot="barcode"]');
    if (!el) throw new Error('thiếu [data-slot="barcode"]');
    return el;
  }

  it('vạch tất định theo mã: đúng số vạch và bề ngang của ticketBarcodeWidths', () => {
    const { container } = render(<TicketBarcode code={CODE} />);
    const bars = [...barcodeOf(container).querySelectorAll('span')];
    expect(bars.map((bar) => bar.style.width)).toEqual(
      ticketBarcodeWidths(CODE).map((width) => `${width}px`),
    );
  });

  it('mang móc in `data-slot="barcode"` và ẩn khỏi trình đọc màn hình', () => {
    // Móc của quy tắc `print-color-adjust: exact` ở globals.css: vạch vẽ bằng nền, thiếu móc thì
    // tắt "in nền" là mất vạch.
    const { container } = render(<TicketBarcode code={CODE} />);
    expect(barcodeOf(container)).toHaveAttribute('aria-hidden', 'true');
  });

  it('nhận class bố cục của nơi gọi (chiều cao, căn lề, khoảng cách)', () => {
    const { container } = render(<TicketBarcode code={CODE} className="mt-3 h-7.5" />);
    expect(barcodeOf(container)).toHaveClass('mt-3', 'h-7.5');
  });
});
