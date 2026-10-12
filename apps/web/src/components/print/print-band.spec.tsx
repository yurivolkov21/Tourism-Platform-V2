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

// Dòng phụ "Booked by {email}" là một <p> mà email nằm trong khối riêng, nên tìm theo chữ của cả dòng.
const subLine = (text: string) =>
  screen.getByText((_, el) => el?.tagName === 'P' && el.textContent === text);

describe('PrintBand', () => {
  it('cột thường: phần đậm rồi phần thường nối " · "', () => {
    render(<PrintBand columns={[MEET]} />);
    expect(screen.getByText('Ticket booth').tagName).toBe('B');
    expect(screen.getByText('Ticket booth').parentElement).toHaveTextContent(
      'Ticket booth · meet your guide at 15:30.',
    );
  });

  // Điểm hẹn admin nhập dài tới 300 ký tự: cột ~60 mm thì tám dòng, đủ đẩy tờ quá một trang.
  it('cột có điểm hẹn kẹp bốn dòng; cột câu cố định đọc trọn', () => {
    render(<PrintBand columns={[MEET, POLICY]} />);
    expect(screen.getByText('Ticket booth').parentElement?.className).toContain('line-clamp-4');
    expect(screen.getByText('Free until 28 Oct.').className).not.toContain('line-clamp');
  });

  it('cột mã đơn: mã mono ở dòng riêng, dòng phụ bên dưới', () => {
    render(<PrintBand columns={[REF]} />);
    expect(screen.getByText('BK-EET0JBTH').className).toContain('font-mono');
    expect(subLine('Booked by a@b.co')).toBeInTheDocument();
  });

  // Cột ~53 mm chỉ chứa ~31 ký tự. Email là một khối: vừa dòng riêng thì xuống dòng nguyên khối
  // ("Booked by" / "nora.dahl@example.com" như bản thảo B1) chứ không gãy trước "@" ngay cạnh
  // "Booked by"; dài hơn dòng riêng mới gãy trước "@" trong khối, không bao giờ giữa chữ
  // ("nora.dahl@exampl / e.com") hay tràn khỏi dải.
  it('email: khối nguyên xuống dòng, điểm ngắt trước "@" nằm trong khối, không tràn cột', () => {
    render(
      <PrintBand
        columns={[{ ...REF, text: 'Booked by constance.wellington-hart@example-travel.com' }]}
      />,
    );
    const sub = subLine('Booked by constance.wellington-hart@example-travel.com');
    const email = sub.querySelector('span');
    expect(email?.className).toContain('inline-block');
    expect(email?.className).toContain('max-w-full');
    expect(email?.textContent).toBe('constance.wellington-hart@example-travel.com');
    expect(email?.querySelector('wbr')).not.toBeNull();
    expect(sub.className).toContain('[overflow-wrap:anywhere]');
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
