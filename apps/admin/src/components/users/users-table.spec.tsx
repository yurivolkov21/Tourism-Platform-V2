import { render, screen, within } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it, vi } from 'vitest';
import type { UsersQuery } from '@/lib/users-query';
import type { UserRowVM } from '@/lib/users-view';
import { UsersTable } from './users-table';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const t = messages.admin.users.list;

const row = (patch: Partial<UserRowVM> = {}): UserRowVM => ({
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  image: null,
  initial: 'A',
  href: '/users/11111111-1111-4111-8111-111111111111',
  role: 'CUSTOMER',
  roleLabel: 'Customer',
  status: 'active',
  statusLabel: 'Active',
  joined: '1 Sep 2026',
  lastActive: '1 Oct 2026',
  ...patch,
});

const QUERY: UsersQuery = { page: 1, limit: 20 };

function renderTable(rows: UserRowVM[]) {
  return render(<UsersTable rows={rows} query={QUERY} total={rows.length} totalPages={1} />);
}

describe('UsersTable', () => {
  it('tên là link sang trang chi tiết; email đứng ngay dưới tên', () => {
    renderTable([row()]);
    expect(screen.getByRole('link', { name: t.viewLabel('Ada Lovelace') })).toHaveAttribute(
      'href',
      '/users/11111111-1111-4111-8111-111111111111',
    );
    expect(screen.getByText('ada@example.com')).toBeInTheDocument();
  });

  it('chip role và chip trạng thái mang đúng nhãn; ngày tham gia và lần hoạt động cuối', () => {
    renderTable([
      row({ role: 'STAFF', roleLabel: 'Staff', status: 'locked', statusLabel: 'Locked' }),
    ]);
    // Soi TRONG hàng dữ liệu: thanh tab phía trên cũng có chữ "Staff" và "Locked", tìm cả trang
    // thì ca này xanh kể cả khi hai chip biến mất (review P4f).
    const dataRow = screen.getByRole('link', { name: t.viewLabel('Ada Lovelace') }).closest('tr');
    if (!dataRow) throw new Error('link tên không nằm trong một hàng của bảng');
    expect(within(dataRow).getByText('Staff')).toBeInTheDocument();
    expect(within(dataRow).getByText('Locked')).toBeInTheDocument();
    expect(within(dataRow).getByText('1 Sep 2026')).toBeInTheDocument();
    expect(within(dataRow).getByText('1 Oct 2026')).toBeInTheDocument();
  });

  it('bảng rỗng nói câu empty, không phải một bảng câm', () => {
    renderTable([]);
    expect(screen.getByText(t.empty)).toBeInTheDocument();
  });
});
