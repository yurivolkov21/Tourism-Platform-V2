import { render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import type { PrintTicketView } from '@/lib/print/print-ticket';
import { PrintTicket } from './print-ticket';

const ACTIVE: PrintTicketView = {
  tone: 'active',
  bandStart: 'Entry · Tour booking',
  bandEnd: 'BK-EET0JBTH',
  title: 'Hội An Old Town & Lantern Evening',
  stamp: { label: 'CONFIRMED', tone: 'confirmed' },
  departs: { big: '29 OCT', sub: 'Thu · 2026 · meet 15:30' },
  returns: { big: '29 OCT', sub: 'Thu · 2026' },
  routeLine: '1 day · Hội An',
  cells: [
    { label: 'Lead traveller', value: 'Nora Dahl' },
    { label: 'Travellers', value: '1 adult' },
    { label: 'Booked', value: '9 Oct 2026' },
    { label: 'Paid with', value: 'Card (Stripe)' },
  ],
  stub: {
    band: 'Admit 1',
    tag: null,
    amountLabel: 'Total paid',
    amount: '$39',
    note: 'Taxes and fees included',
    barcode: 'BK-EET0JBTH',
    footer: null,
  },
  notice: null,
};

const ticket = (container: HTMLElement) => container.querySelector('[data-slot="print-ticket"]');

describe('PrintTicket', () => {
  it('vé còn hiệu lực: dải, tên, ngày, giờ hẹn, bốn ô, mộc, cuống có mã vạch và mã', () => {
    const { container } = render(<PrintTicket view={ACTIVE} />);
    expect(ticket(container)).toHaveAttribute('data-tone', 'active');
    expect(screen.getByText('Entry · Tour booking')).toBeInTheDocument();
    expect(screen.getByText('Hội An Old Town & Lantern Evening')).toBeInTheDocument();
    expect(screen.getByText(messages.bookingDetail.ticket.departs)).toBeInTheDocument();
    expect(screen.getByText('Thu · 2026 · meet 15:30')).toBeInTheDocument();
    expect(screen.getByText('1 day · Hội An')).toBeInTheDocument();
    expect(screen.getByText('Nora Dahl')).toBeInTheDocument();
    expect(screen.getByText('CONFIRMED')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="barcode"]')).not.toBeNull();
    expect(screen.getAllByText('BK-EET0JBTH')).toHaveLength(2); // dải và dưới mã vạch
  });

  it('vé chờ: viền đứt, nhãn "Not yet a voucher", hộp "Pay by", không mã vạch', () => {
    const view: PrintTicketView = {
      ...ACTIVE,
      tone: 'pending',
      stub: {
        ...ACTIVE.stub,
        band: 'Unpaid',
        tag: 'Not yet a voucher',
        amountLabel: null,
        barcode: null,
        footer: { label: 'Pay by', value: '19:04 · 9 Oct' },
      },
    };
    const { container } = render(<PrintTicket view={view} />);
    expect(ticket(container)).toHaveAttribute('data-tone', 'pending');
    expect(ticket(container)?.className).toContain('border-dashed');
    expect(screen.getByText('Not yet a voucher')).toBeInTheDocument();
    expect(screen.getByText('19:04 · 9 Oct')).toBeInTheDocument();
    expect(container.querySelector('[data-slot="barcode"]')).toBeNull();
    expect(screen.getAllByText('BK-EET0JBTH')).toHaveLength(1); // chỉ ở dải
  });

  it('vé hết hiệu lực: dải thông báo thay thân vé', () => {
    const notice = 'This booking was cancelled — this voucher is no longer valid.';
    render(
      <PrintTicket
        view={{ ...ACTIVE, tone: 'closed', notice, stamp: { label: 'REFUNDED', tone: 'muted' } }}
      />,
    );
    expect(screen.getByText(notice)).toBeInTheDocument();
    expect(screen.queryByText('Nora Dahl')).toBeNull();
    expect(screen.queryByText(messages.bookingDetail.ticket.departs)).toBeNull();
    // Bảng spec §3.3 hàng `cancelled`: mộc CANCELLED / REFUNDED vẫn đóng cạnh tên tour — chỉ thân vé
    // (ngày, đường nối, bốn ô) thay bằng dải.
    expect(screen.getByText('Hội An Old Town & Lantern Evening')).toBeInTheDocument();
    expect(screen.getByText('REFUNDED')).toBeInTheDocument();
  });
});
