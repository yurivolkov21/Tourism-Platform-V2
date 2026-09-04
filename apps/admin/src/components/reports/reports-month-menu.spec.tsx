import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { monthOptions, reportsHref } from '@/lib/reports-query';
import { ReportsMonthMenu } from './reports-month-menu';

/**
 * Ô tháng của `/reports`, chuyển từ `ToolbarSelect` sang kit `ToolbarFilterMenu`
 * ngày 03/09 (đợt 3, user chốt: chỉnh luôn cho giống ba nút kia).
 *
 * Spec canh phần RIÊNG của vùng — kit đã có spec của nó. Ba thứ đáng khoá:
 *
 * 1. Ô này KHÔNG có mục "tất cả": một báo cáo luôn thuộc đúng một tháng. Đây
 *    là consumer duy nhất bỏ `allItem`, nên đáng có test canh.
 * 2. Tháng lạ trên URL không được đẩy tiếp — `safeParse` chặn trước khi điều
 *    hướng (nếp bookings, review F1).
 * 3. Tháng đang xem nằm ngoài 12 tháng vẫn phải có mặt VÀ được tích: đó là
 *    lý do `monthOptions` chèn nó lên đầu.
 */
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: (href: string) => push(href) }),
}));

const t = messages.admin.reports;
const NOW = new Date('2026-09-15T00:00:00.000Z');
const OPTIONS = monthOptions(NOW, 12);

beforeEach(() => {
  push.mockReset();
});

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: new RegExp(t.monthLabel) }));
  await screen.findByRole('menuitemradio', { name: 'September 2026' });
}

describe('ReportsMonthMenu', () => {
  it('nút đọc ra tháng đang xem', () => {
    render(<ReportsMonthMenu month="2026-07" options={OPTIONS} />);

    const trigger = screen.getByRole('button', { name: new RegExp(t.monthLabel) });
    expect(trigger).toHaveTextContent('July 2026');
    expect(trigger).toHaveAccessibleName(`${t.monthLabel}: July 2026`);
  });

  it('KHÔNG có mục "tất cả" — một báo cáo luôn thuộc đúng một tháng', async () => {
    const user = userEvent.setup();
    render(<ReportsMonthMenu month="2026-09" options={OPTIONS} />);
    await openMenu(user);

    // Đúng 12 mục, không dư mục nào mời bấm vào một báo cáo không tồn tại.
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(12);
    expect(screen.queryByRole('menuitemradio', { name: /All/ })).toBeNull();
  });

  it('chọn một tháng thì điều hướng sang báo cáo tháng đó', async () => {
    const user = userEvent.setup();
    render(<ReportsMonthMenu month="2026-09" options={OPTIONS} />);
    await openMenu(user);

    await user.click(screen.getByRole('menuitemradio', { name: 'March 2026' }));

    expect(push).toHaveBeenCalledWith(reportsHref('2026-03'));
  });

  it('tháng ngoài dải 12 tháng vẫn có mặt và được tích', async () => {
    const user = userEvent.setup();
    render(<ReportsMonthMenu month="2024-03" options={monthOptions(NOW, 12, '2024-03')} />);

    expect(screen.getByRole('button', { name: new RegExp(t.monthLabel) })).toHaveTextContent(
      'March 2024',
    );

    await openMenu(user);
    expect(screen.getByRole('menuitemradio', { name: 'March 2024' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('giá trị không phải tháng hợp lệ thì KHÔNG điều hướng đi đâu cả', async () => {
    const user = userEvent.setup();
    // Không dựng được ca này qua UI thật (mọi mục đều hợp lệ), nên bơm thẳng
    // một option rác — chốt chặn là `safeParse`, không phải danh sách.
    render(
      <ReportsMonthMenu month="2026-09" options={[...OPTIONS, { value: 'nope', label: 'Nope' }]} />,
    );
    await openMenu(user);

    await user.click(screen.getByRole('menuitemradio', { name: 'Nope' }));

    expect(push).not.toHaveBeenCalled();
  });
});
