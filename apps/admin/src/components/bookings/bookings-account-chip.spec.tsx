import { render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import type { BookingsQuery } from '@/lib/bookings-query';
import { BookingsAccountChip } from './bookings-toolbar';

/**
 * Chip của bộ lọc tài khoản (G45): nói đang lọc theo ai, và gỡ được bằng một link chỉ bỏ `user`.
 * Email chỉ có khi phiên là Owner — trang không gọi `users.byId` cho Staff — nên còn một nhãn
 * chung, không đoán.
 */
const t = messages.admin.bookings.list.accountFilter;
const USER = '4f2a1b3c-0000-4000-8000-000000000001';
const QUERY: BookingsQuery = { page: 1, limit: 20, status: 'PAID', userId: USER, allDates: true };

describe('BookingsAccountChip', () => {
  it('nói đúng tài khoản đang lọc, và nút gỡ chỉ bỏ `user`, giữ mọi bộ lọc khác', () => {
    render(<BookingsAccountChip query={QUERY} email="ada@example.com" />);

    expect(screen.getByText(t.label('ada@example.com'))).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.remove })).toHaveAttribute(
      'href',
      '/bookings?status=PAID&dates=all',
    );
  });

  it('không có email (Staff, hay tài khoản không còn) thì nhãn chung, nút gỡ vẫn có', () => {
    render(<BookingsAccountChip query={QUERY} email={null} />);

    expect(screen.getByText(t.unknown)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.remove })).toBeInTheDocument();
  });

  it('không lọc theo tài khoản thì không có chip', () => {
    const { container } = render(
      <BookingsAccountChip query={{ page: 1, limit: 20 }} email="ada@example.com" />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
