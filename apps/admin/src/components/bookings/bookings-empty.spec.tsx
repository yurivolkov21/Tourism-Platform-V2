import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { BookingsQuery } from '@/lib/bookings-query';
import { BookingsTable } from './bookings-table';

/**
 * Ô rỗng của `/bookings` khi đang lọc ngày (review A1, 20/10). Khoảng ngày CỘNG DỒN với ô tìm
 * kiếm, trạng thái và tài khoản: người trực gõ mã một booking của tháng trước thì bảng rỗng trong
 * khi tháng đang lọc vẫn có hàng chục booking. Câu phải nói "không có booking KHỚP", không được
 * nói khoảng ngày ấy không có booking nào. Pin chữ thật, không gọi lại hàm i18n, để đổi câu về
 * bản cũ là đỏ.
 */
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

function renderEmpty(query: Partial<BookingsQuery>) {
  render(
    <BookingsTable
      rows={[]}
      query={{ page: 1, limit: 20, ...query }}
      accountEmail={null}
      total={0}
      totalPages={1}
    />,
  );
}

describe('BookingsTable — ô rỗng khi đang lọc ngày', () => {
  it('tìm một mã trong khoảng đang lọc: câu nói "matching", không nói khoảng ấy trống', () => {
    renderEmpty({ search: 'BK-OLD00001', from: '2026-10-01', to: '2026-10-31' });

    expect(screen.getByText(/^No matching bookings were created between /)).toBeInTheDocument();
    expect(screen.queryByText(/^No bookings were created/)).not.toBeInTheDocument();
  });

  it('khoảng một đầu giữ dạng câu riêng của nó, cũng "matching"', () => {
    renderEmpty({ from: '2026-10-01' });
    expect(screen.getByText(/^No matching bookings were created on or after /)).toBeInTheDocument();
  });

  it('chỉ có ngày cuối: "on or before", cũng "matching"', () => {
    renderEmpty({ to: '2026-10-31' });
    expect(
      screen.getByText(/^No matching bookings were created on or before /),
    ).toBeInTheDocument();
  });
});
