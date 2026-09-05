import { render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import type { BookingRowVM } from '@/lib/bookings-view';
import { RecentBookingsTable } from './recent-bookings-table';

/**
 * Bảng "Recent bookings" (ADR-0036 §3): chỉ soi phần RIÊNG của nó — mã là
 * link trần sang chi tiết, có lối "View all" về `/bookings`, cột Created hiện,
 * và ô rỗng nói đúng câu. Ô thân dùng chung đã có `toBookingRow` canh chữ.
 */

const t = messages.admin.dashboard.table;

const ROW: BookingRowVM = {
  code: 'NX-ABC123',
  tourTitle: 'Ha Long Bay Cruise',
  status: 'PAID',
  statusLabel: 'Paid',
  guests: 3,
  guestsLabel: '2 adults, 1 child',
  amount: '$1,497.00',
  customerName: 'Ann Nguyen',
  customerEmail: 'ann@example.com',
  departure: '14 Sep 2026 – 20 Sep 2026',
  href: '/bookings/NX-ABC123',
  createdAt: '29 Aug 2026, 02:05 UTC',
};

describe('RecentBookingsTable', () => {
  it('mã booking là link TRẦN sang trang chi tiết — không mang bộ lọc nào', () => {
    render(<RecentBookingsTable rows={[ROW]} />);
    expect(screen.getByRole('link', { name: 'NX-ABC123' })).toHaveAttribute(
      'href',
      '/bookings/NX-ABC123',
    );
  });

  it('in cột Created và ô thân dùng chung', () => {
    render(<RecentBookingsTable rows={[ROW]} />);
    expect(screen.getByText('29 Aug 2026, 02:05 UTC')).toBeInTheDocument();
    expect(screen.getByText('Ha Long Bay Cruise')).toBeInTheDocument();
    expect(screen.getByText('$1,497.00')).toBeInTheDocument();
  });

  it('khe views là tiêu đề TĨNH, không phải một bộ chọn một mục', () => {
    render(<RecentBookingsTable rows={[ROW]} />);
    expect(screen.getByRole('heading', { name: t.tab })).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  it('footer là lối về /bookings thay cho phân trang', () => {
    render(<RecentBookingsTable rows={[ROW]} />);
    expect(screen.getByRole('link', { name: t.viewAll })).toHaveAttribute('href', '/bookings');
    expect(screen.queryByText(/Rows per page/)).not.toBeInTheDocument();
  });

  it('không có booking nào: ô rỗng nói đúng câu của dashboard', () => {
    render(<RecentBookingsTable rows={[]} />);
    expect(screen.getByText(t.empty)).toBeInTheDocument();
  });
});
