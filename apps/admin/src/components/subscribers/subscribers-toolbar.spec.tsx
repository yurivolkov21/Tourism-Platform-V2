import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SubscribersQuery } from '@/lib/subscribers-query';
import { SubscribersClearFilters, SubscribersDateRange } from './subscribers-toolbar';

/**
 * Ô ngày và nút xoá của `/subscribers` (G43). Hành vi lịch đã có bộ test riêng ở
 * `bookings-date-range.spec.tsx` (kit `ToolbarDateRange`); ở đây chỉ canh phần RIÊNG của
 * vùng: nhãn nói đúng cột ngày nào, và nút xoá gỡ cả hai ô ngày mà không đụng dải tab.
 */
const t = messages.admin.subscribers.list;
const shared = messages.admin.table;

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: (href: string) => push(href) }),
}));

const ACTIVE: SubscribersQuery = { page: 1, limit: 20, active: true };

beforeEach(() => {
  push.mockReset();
});

describe('SubscribersDateRange', () => {
  it('chưa lọc ngày: nút đọc "Any date", nhãn đọc-màn-hình gọi đúng cột ngày đăng ký', () => {
    render(<SubscribersDateRange query={ACTIVE} />);

    expect(screen.getByRole('button')).toHaveAccessibleName(
      `${t.dateFilterLabel}: ${shared.dateAny}`,
    );
  });

  it('đang lọc thì nút mang đúng khoảng trên URL', () => {
    render(<SubscribersDateRange query={{ ...ACTIVE, from: '2026-09-01', to: '2026-09-30' }} />);

    expect(screen.getByRole('button')).toHaveTextContent('Sep 01 – Sep 30, 2026');
  });
});

describe('SubscribersClearFilters', () => {
  it('chỉ có khoảng ngày cũng hiện nút, và cú bấm gỡ cả hai ô ngày', async () => {
    const user = userEvent.setup();
    render(<SubscribersClearFilters query={{ ...ACTIVE, from: '2026-09-01', to: '2026-09-30' }} />);

    await user.click(screen.getByRole('button', { name: shared.clearFilters }));

    expect(push).toHaveBeenCalledWith('/subscribers');
  });

  it('GIỮ dải tab — nó ở khe views, không phải bộ lọc của hàng này', async () => {
    const user = userEvent.setup();
    render(
      <SubscribersClearFilters
        query={{ page: 3, limit: 20, active: false, source: 'footer', to: '2026-09-30' }}
      />,
    );

    await user.click(screen.getByRole('button', { name: shared.clearFilters }));

    expect(push).toHaveBeenCalledWith('/subscribers?active=false');
  });
});
