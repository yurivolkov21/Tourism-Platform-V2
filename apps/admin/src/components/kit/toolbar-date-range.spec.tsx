import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToolbarDateRange } from './toolbar-date-range';

/**
 * Trần của lịch (review A1-14). Cả bốn vùng dùng kit lọc theo một mốc ĐÃ QUA: ngày đặt đơn, ngày
 * gửi review, ngày đăng ký, ngày thao tác. Lịch từng cho chọn tới hai năm sau: chọn 05–10/11 vào
 * ngày 20/10 thì bảng rỗng, còn hàng thẻ số liệu của `/bookings` ghi "Showing Oct 20 – Oct 20,
 * 2026", Revenue $0.00, như thể hôm nay chưa có đơn nào.
 *
 * Hành vi chọn khoảng (hai cú bấm, guard ghim trang, nhãn nút) canh ở
 * `bookings-date-range.spec.tsx`; ở đây chỉ canh trần.
 */
const LABEL = 'Filter by test date';

function hrefFor(patch: { from?: string | null; to?: string | null; page?: number }): string {
  const params = new URLSearchParams();
  if (patch.from) params.set('from', patch.from);
  if (patch.to) params.set('to', patch.to);
  return `/rows?${params}`;
}

async function openCalendar() {
  const user = userEvent.setup();
  const onNavigate = vi.fn();
  render(
    <ToolbarDateRange idPrefix="rows" label={LABEL} hrefFor={hrefFor} onNavigate={onNavigate} />,
  );
  await user.click(screen.getByRole('button', { name: new RegExp(LABEL) }));
  return { user, onNavigate, calendar: within(await screen.findByRole('dialog')) };
}

describe('ToolbarDateRange: lịch dừng ở hôm nay', () => {
  // Chỉ giả `Date`: popover và userEvent vẫn cần timer thật. 05:00Z rơi vào cùng ngày 20/10 ở
  // UTC, ở Việt Nam và ở New York, nên ca không phụ thuộc múi giờ của máy chạy test.
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-20T05:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('ngày SAU hôm nay bị khoá, khoảng kết thúc đúng hôm nay vẫn chọn được', async () => {
    const { user, onNavigate, calendar } = await openCalendar();

    expect(calendar.getByRole('button', { name: /October 21st, 2026/i })).toBeDisabled();

    await user.click(calendar.getByRole('button', { name: /October 10th, 2026/i }));
    await user.click(calendar.getByRole('button', { name: /October 20th, 2026/i }));

    expect(onNavigate).toHaveBeenCalledWith('/rows?from=2026-10-10&to=2026-10-20');
  });

  it('dropdown năm dừng ở năm nay, không mời chọn năm sau', async () => {
    const { calendar } = await openCalendar();

    // Lịch hai tháng nên mỗi tháng một dropdown năm.
    for (const years of calendar.getAllByRole('combobox', { name: /year/i })) {
      expect(within(years).getByRole('option', { name: '2026' })).toBeInTheDocument();
      expect(within(years).queryByRole('option', { name: '2027' })).toBeNull();
    }
  });
});
