import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookingsQuery } from '@/lib/bookings-query';
import { BookingsDateRange } from './bookings-toolbar';

/**
 * Bộ lọc khoảng ngày của `/bookings` (spec P4b §3-F6). Nó chỉ điều hướng —
 * nhưng có một ca mà "chỉ điều hướng" là chưa đủ: khi giá trị vừa gõ bị luật
 * khoảng-ngược vứt đi, URL đích TRÙNG URL hiện tại nên không có điều hướng
 * nào xảy ra, và ô date sẽ đứng đó khoe một bộ lọc không tồn tại (review F6).
 */
const t = messages.admin.bookings.list;

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: (href: string) => push(href) }),
}));

const BASE: BookingsQuery = { page: 1, limit: 20 };

beforeEach(() => {
  push.mockReset();
});

describe('BookingsDateRange', () => {
  it('hai ô mang đúng khoảng đang lọc trên URL', () => {
    render(<BookingsDateRange query={{ ...BASE, from: '2026-09-01', to: '2026-09-30' }} />);

    expect(screen.getByLabelText(t.dateFrom)).toHaveValue('2026-09-01');
    expect(screen.getByLabelText(t.dateTo)).toHaveValue('2026-09-30');
  });

  it('chọn ngày bắt đầu → điều hướng sang URL mang from', async () => {
    const user = userEvent.setup();
    render(<BookingsDateRange query={BASE} />);

    await user.type(screen.getByLabelText(t.dateFrom), '2026-09-01');

    expect(push).toHaveBeenCalledWith('/bookings?from=2026-09-01');
  });

  it('ngày kết thúc SỚM HƠN ngày bắt đầu: không điều hướng, và ô tự quay về rỗng', async () => {
    const user = userEvent.setup();
    render(<BookingsDateRange query={{ ...BASE, from: '2026-09-01' }} />);

    await user.type(screen.getByLabelText(t.dateTo), '2026-08-15');

    // URL đích trùng URL hiện tại (`to` bị vứt) → push là vô nghĩa…
    expect(push).not.toHaveBeenCalled();
    // …nên chính component phải kéo ô về đúng thứ đang lọc, kẻo màn hình
    // hiện "đến 15/08" trong khi bảng lọc từ 01/09 trở đi. Truy vấn LẠI: đổi
    // `key` là unmount + mount, nên node cũ không còn nằm trong tài liệu.
    expect(screen.getByLabelText(t.dateTo)).toHaveValue('');
  });

  it('nút xoá chỉ hiện khi có ngày, và xoá CẢ HAI đầu trong một cú bấm', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<BookingsDateRange query={BASE} />);
    expect(screen.queryByRole('button', { name: t.clearDates })).not.toBeInTheDocument();

    rerender(<BookingsDateRange query={{ ...BASE, from: '2026-09-01', to: '2026-09-30' }} />);
    await user.click(screen.getByRole('button', { name: t.clearDates }));

    expect(push).toHaveBeenCalledWith('/bookings');
  });

  it('nút xoá vẫn hiện khi mới có một đầu', () => {
    render(<BookingsDateRange query={{ ...BASE, to: '2026-09-30' }} />);

    expect(screen.getByRole('button', { name: t.clearDates })).toBeInTheDocument();
  });
});
