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
 * Spec canh phần RIÊNG của vùng — kit đã có spec của nó. Bốn thứ đáng khoá:
 *
 * 1. Ô này KHÔNG có mục "tất cả": một báo cáo luôn thuộc đúng một tháng. Đây
 *    là consumer duy nhất bỏ `allItem`, nên đáng có test canh.
 * 2. Không có tháng nào trước 01/2026 (user chốt 15/09/2026: dữ liệu bắt đầu từ
 *    tháng 1/2026, nên các tháng trước đó không được tồn đọng trong menu).
 * 3. Tháng lạ trên URL không được đẩy tiếp — `safeParse` chặn trước khi điều
 *    hướng (nếp bookings, review F1).
 * 4. Tháng đang xem nằm ngoài dải vẫn phải có mặt VÀ được tích: đó là lý do
 *    `monthOptions` chèn nó lên đầu.
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

  it('KHÔNG có mục "tất cả" và không có tháng nào trước 01/2026', async () => {
    const user = userEvent.setup();
    render(<ReportsMonthMenu month="2026-09" options={OPTIONS} />);
    await openMenu(user);

    // Đúng 9 mục (01–09/2026), không dư mục nào mời bấm vào một báo cáo không tồn tại.
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(9);
    expect(screen.queryByRole('menuitemradio', { name: /All/ })).toBeNull();
    expect(screen.queryByRole('menuitemradio', { name: /2025/ })).toBeNull();
  });

  it('chọn một tháng thì điều hướng sang báo cáo tháng đó', async () => {
    const user = userEvent.setup();
    render(<ReportsMonthMenu month="2026-09" options={OPTIONS} />);
    await openMenu(user);

    await user.click(screen.getByRole('menuitemradio', { name: 'March 2026' }));

    expect(push).toHaveBeenCalledWith(reportsHref('2026-03'));
  });

  it('tháng ngoài dải vẫn có mặt và được tích', async () => {
    const user = userEvent.setup();
    // Mốc 2027-06: dải 12 tháng là 07/2026 → 06/2027, nên 03/2026 nằm ngoài dải
    // nhưng vẫn từ 01/2026 trở đi — đúng ca mở lại một link cũ.
    const later = new Date('2027-06-15T00:00:00.000Z');
    render(<ReportsMonthMenu month="2026-03" options={monthOptions(later, 12, '2026-03')} />);

    expect(screen.getByRole('button', { name: new RegExp(t.monthLabel) })).toHaveTextContent(
      'March 2026',
    );

    await openMenu(user);
    expect(screen.getByRole('menuitemradio', { name: 'March 2026' })).toHaveAttribute(
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
