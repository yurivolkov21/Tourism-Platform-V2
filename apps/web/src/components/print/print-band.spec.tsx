import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { PrintColumn } from '@/lib/print/print-ticket';
import { PrintBand } from './print-band';

const MEET: PrintColumn = {
  heading: 'Where to meet',
  strong: 'Ticket booth',
  text: 'meet your guide at 15:30.',
  reference: false,
};
const POLICY: PrintColumn = {
  heading: 'Cancellation',
  strong: null,
  text: 'Free until 28 Oct.',
  reference: false,
};
const REF: PrintColumn = {
  heading: 'Booking reference',
  strong: 'BK-EET0JBTH',
  text: 'Booked by a@b.co',
  reference: true,
};

const band = (container: HTMLElement) => container.querySelector('[data-slot="print-band"]');

describe('PrintBand', () => {
  it('cột thường: phần đậm rồi phần thường nối " · "', () => {
    render(<PrintBand columns={[MEET]} />);
    expect(screen.getByText('Ticket booth').tagName).toBe('B');
    expect(screen.getByText('Ticket booth').parentElement).toHaveTextContent(
      'Ticket booth · meet your guide at 15:30.',
    );
  });

  // Điểm hẹn admin nhập dài tới 300 ký tự: cột ~60 mm thì tám dòng, đủ đẩy tờ quá một trang.
  it('chữ của cột kẹp bốn dòng', () => {
    render(<PrintBand columns={[MEET]} />);
    expect(screen.getByText('Ticket booth').parentElement?.className).toContain('line-clamp-4');
  });

  it('cột mã đơn: mã mono ở dòng riêng, dòng phụ bên dưới', () => {
    render(<PrintBand columns={[REF]} />);
    expect(screen.getByText('BK-EET0JBTH').className).toContain('font-mono');
    expect(screen.getByText('Booked by a@b.co').tagName).toBe('P');
  });

  // Cột ~53 mm chỉ chứa ~31 ký tự: email dài không có chỗ ngắt sẽ tràn khỏi dải. Ngắt có chủ đích
  // trước "@" thay vì giữa chữ ("nora.dahl@exampl / e.com").
  it('email dài: có điểm ngắt trước "@", không tràn cột', () => {
    const { container } = render(
      <PrintBand
        columns={[{ ...REF, text: 'Booked by constance.wellington-hart@example-travel.com' }]}
      />,
    );
    const sub = screen.getByText('Booked by constance.wellington-hart@example-travel.com');
    expect(sub.querySelector('wbr')).not.toBeNull();
    expect(sub.className).toContain('[overflow-wrap:anywhere]');
    expect(container.textContent).toContain('constance.wellington-hart@example-travel.com');
  });

  it('ba cột: voucher cột đầu rộng hơn (5b), hoá đơn ba cột đều (B1); hai cột thì hai', () => {
    const { container, rerender } = render(<PrintBand columns={[MEET, POLICY, REF]} wideFirst />);
    expect(band(container)?.className).toContain('grid-cols-[1.15fr_1fr_1fr]');
    rerender(<PrintBand columns={[MEET, POLICY, REF]} />);
    expect(band(container)?.className).toContain('grid-cols-3');
    rerender(<PrintBand columns={[MEET, REF]} wideFirst />);
    expect(band(container)?.className).toContain('grid-cols-2');
  });
});
