import { render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it, vi } from 'vitest';
import type { BookingRowVM } from '@/lib/bookings-view';
import { BookingsTable } from './bookings-table';

/**
 * Cột Created của `/bookings` (review A1-18, 20/10). Bộ lọc ngày, câu bảng trống và hàng card đều
 * nói về NGÀY ĐẶT, mà trước đây bảng chỉ in ngày đi: chuyến tháng 12 nằm trong danh sách "tháng 10"
 * mà không ô nào cho thấy vì sao. Bảng đơn gần đây của dashboard đã có cột này; hai bảng đọc cùng
 * một mốc `createdAt` qua `toBookingRow` (theo UTC, cùng thước với bộ lọc).
 */
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const t = messages.admin.bookings.list;

const ROW: BookingRowVM = {
  code: 'BK-DEC01',
  tourTitle: 'Sapa trek',
  status: 'PAID',
  statusLabel: 'Paid',
  guests: 2,
  guestsLabel: '2 adults',
  amount: '$98.00',
  customerName: 'Ada',
  customerEmail: 'ada@x.test',
  departure: '12 Dec 2026 – 14 Dec 2026',
  href: '/bookings/BK-DEC01',
  createdAt: '5 Oct 2026, 08:00 UTC',
  createdDate: '5 Oct 2026',
  createdTime: '08:00 UTC',
};

function renderTable() {
  render(
    <BookingsTable
      rows={[ROW]}
      query={{ page: 1, limit: 20, from: '2026-10-01', to: '2026-10-31' }}
      accountEmail={null}
      total={1}
      totalPages={1}
    />,
  );
}

describe('BookingsTable — cột Created', () => {
  it('in ngày đặt thành hai dòng (ngày, giờ UTC) cạnh ngày đi; tiêu đề "Created" như dashboard', () => {
    renderTable();

    expect(screen.getByRole('columnheader', { name: 'Created' })).toBeInTheDocument();
    expect(screen.getByText('5 Oct 2026')).toBeInTheDocument();
    expect(screen.getByText('08:00 UTC')).toBeInTheDocument();
    expect(screen.getByText('12 Dec 2026 – 14 Dec 2026')).toBeInTheDocument();
  });

  /**
   * Nút Export của cột `export` (cột `w-0`) treo sang trái, đè lên nửa phải ô tiêu đề của cột đứng
   * trước nó. Cột ấy phải là Customer: rộng nhờ email, chữ tiêu đề ngắn nằm bên trái. Bản đầu đặt
   * Created cuối thì nút che mất chữ "Created" ở màn 1440px (đo 20/10 trên bản build).
   */
  it('đứng ngay sau Tour, và Customer vẫn là cột dữ liệu cuối trước cột Export', () => {
    renderTable();

    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent);
    // Bỏ ô chọn cả trang ở đầu và ô Export ở cuối.
    expect(headers.slice(1, -1)).toEqual([
      t.columns.code,
      t.columns.tour,
      t.columns.created,
      t.columns.status,
      t.columns.guests,
      t.columns.amount,
      t.columns.customer,
    ]);
  });
});
