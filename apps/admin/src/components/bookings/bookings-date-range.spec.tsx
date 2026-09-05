import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BookingsQuery } from '@/lib/bookings-query';
import { BookingsDateRange } from './bookings-toolbar';

/**
 * Bộ lọc khoảng ngày của `/bookings` (spec P4b §3-F6), từ 05/09 là MỘT nút mở
 * lịch hai tháng thay cho hai ô chữ (`@shadcn-space/date-picker-02`, user chốt
 * qua bản demo `docs/design/mockups/admin-toolbar-sizing.src.html`).
 *
 * Bộ test cũ canh hành vi ô CHỮ — gõ dở, gõ rác, chốt lúc rời ô — và toàn bộ
 * lớp ca đó biến mất cùng ô chữ. Cái Ở LẠI, và là thứ bộ này canh:
 *
 * 1. **Cú bấm thứ nhất không được điều hướng.** `mode="range"` chốt bằng hai
 *    cú bấm; đẩy URL ngay cú đầu là một lần fetch cả trang cho một khoảng còn
 *    dở dang.
 * 2. **Chọn lại đúng khoảng đang lọc thì đứng yên** — và phép so phải GHIM
 *    trang, bài học `go` của bản cũ (vòng vá review F6 lần 2): không ghim thì
 *    từ trang 2 trở đi hai href khác nhau CHỈ VÌ `page`, guard trượt, và mỗi
 *    cú bấm lại là một lần fetch thừa.
 * 3. **Nút phải đọc ra thứ đang nằm trên URL**, kể cả ca `?to=` một mình —
 *    lịch không bấm ra được ca ấy nhưng URL vẫn nhận nó.
 */
const t = messages.admin.bookings.list;
const shared = messages.admin.table;

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: (href: string) => push(href) }),
}));

const BASE: BookingsQuery = { page: 1, limit: 20 };

beforeEach(() => {
  push.mockReset();
});

/** Mở lịch và trả về chính popover, để `getByRole` không quét cả trang. */
async function openCalendar(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: new RegExp(t.dateFilterLabel) }));
  return within(await screen.findByRole('dialog'));
}

describe('BookingsDateRange', () => {
  it('nút mang đúng khoảng đang lọc, năm in MỘT lần khi hai đầu cùng năm', () => {
    render(<BookingsDateRange query={{ ...BASE, from: '2026-09-01', to: '2026-09-30' }} />);

    expect(screen.getByRole('button')).toHaveTextContent('Sep 01 – Sep 30, 2026');
  });

  it('hai đầu KHÁC năm thì in đủ cả hai năm', () => {
    render(<BookingsDateRange query={{ ...BASE, from: '2025-12-20', to: '2026-01-05' }} />);

    expect(screen.getByRole('button')).toHaveTextContent('Dec 20, 2025 – Jan 05, 2026');
  });

  it('chưa lọc gì thì nút nói "Any date", không để trống', () => {
    render(<BookingsDateRange query={BASE} />);

    expect(screen.getByRole('button')).toHaveTextContent(shared.dateAny);
  });

  it('chỉ có một đầu vẫn đọc ra được — URL gõ tay tới được ca này', () => {
    const { rerender } = render(<BookingsDateRange query={{ ...BASE, from: '2026-09-01' }} />);
    expect(screen.getByRole('button')).toHaveTextContent('From Sep 01, 2026');

    // `mode="range"` KHÔNG bấm ra được ca này, nhưng `?to=` một mình vẫn lọc
    // thật ở API nên nút phải nói đúng thay vì rơi về "Any date".
    rerender(<BookingsDateRange query={{ ...BASE, to: '2026-09-30' }} />);
    expect(screen.getByRole('button')).toHaveTextContent('Until Sep 30, 2026');
  });

  it('nhãn đọc-màn-hình nói RÕ cột ngày nào đang bị lọc', () => {
    render(<BookingsDateRange query={BASE} />);

    // Chữ trên nút là GIÁ TRỊ; mục đích phải nằm ở aria-label, kẻo người dùng
    // trình đọc màn hình nghe "Any date" mà không biết ngày gì.
    expect(screen.getByRole('button')).toHaveAccessibleName(
      `${t.dateFilterLabel}: ${shared.dateAny}`,
    );
  });

  it('cú bấm THỨ NHẤT chưa điều hướng — khoảng còn dở dang', async () => {
    const user = userEvent.setup();
    render(<BookingsDateRange query={BASE} />);
    const calendar = await openCalendar(user);

    await user.click(calendar.getByRole('button', { name: /September 10th, 2026/i }));

    expect(push).not.toHaveBeenCalled();
  });

  it('đủ hai đầu thì điều hướng sang URL mang cả khoảng, dạng ISO', async () => {
    const user = userEvent.setup();
    render(<BookingsDateRange query={BASE} />);
    const calendar = await openCalendar(user);

    await user.click(calendar.getByRole('button', { name: /September 10th, 2026/i }));
    await user.click(calendar.getByRole('button', { name: /September 20th, 2026/i }));

    expect(push).toHaveBeenCalledWith('/bookings?from=2026-09-10&to=2026-09-20');
  });

  it('chọn lại ĐÚNG khoảng đang lọc thì đứng yên, không fetch lại cả trang', async () => {
    const user = userEvent.setup();
    render(<BookingsDateRange query={{ ...BASE, from: '2026-09-10', to: '2026-09-20' }} />);
    const calendar = await openCalendar(user);

    await user.click(calendar.getByRole('button', { name: /September 10th, 2026/i }));
    await user.click(calendar.getByRole('button', { name: /September 20th, 2026/i }));

    expect(push).not.toHaveBeenCalled();
  });

  it('từ TRANG 2 cũng vậy — phép so ghim trang nên guard không trượt', async () => {
    // Không ghim `page: 1` ở cả hai vế thì href-patch mất `page` còn href-hiện
    // tại giữ `page=2`, hai chuỗi khác nhau CHỈ VÌ page và guard hết tác dụng.
    const user = userEvent.setup();
    render(
      <BookingsDateRange query={{ ...BASE, page: 2, from: '2026-09-10', to: '2026-09-20' }} />,
    );
    const calendar = await openCalendar(user);

    await user.click(calendar.getByRole('button', { name: /September 10th, 2026/i }));
    await user.click(calendar.getByRole('button', { name: /September 20th, 2026/i }));

    expect(push).not.toHaveBeenCalled();
  });

  it('lịch mở ra có dropdown tháng và năm — thứ bù cho việc mất ô gõ tay', async () => {
    const user = userEvent.setup();
    render(<BookingsDateRange query={{ ...BASE, from: '2026-09-01', to: '2026-09-30' }} />);
    const calendar = await openCalendar(user);

    // Không có hai cái này thì lọc một tháng của năm ngoái là hơn chục cú bấm
    // mũi tên, và đổi sang range picker thành một bước lùi.
    expect(calendar.getAllByRole('combobox').length).toBeGreaterThanOrEqual(2);
  });

  it('KHÔNG còn nút xoá ngày riêng — nó đã gộp vào ToolbarClearFilters (05/09)', () => {
    render(<BookingsDateRange query={{ ...BASE, from: '2026-09-01', to: '2026-09-30' }} />);

    // Cụm này chỉ còn ĐÚNG một nút: cái mở lịch.
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });
});
