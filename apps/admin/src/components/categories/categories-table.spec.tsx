import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminCategoryRow } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it, vi } from 'vitest';
import { toCategoryRowVMs } from '@/lib/categories-view';
import { requestCreate } from '@/lib/quick-create';
import { CategoriesTable } from './categories-table';

/**
 * Router ỔN ĐỊNH qua các lần render, như Next thật (`useRouter` memo theo router). Mock trả
 * object mới mỗi render thì `refreshList` đổi danh tính ở MỌI render — ca đối chứng của D1 cũng
 * mất focus, và lỗi thật (server action đổi danh tính sau mỗi `router.refresh()`) bị che đi.
 */
const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => router }));

const t = messages.admin.categories;

const DAY_TRIPS: AdminCategoryRow = {
  id: 'c1400001-0000-4000-8000-000000000001',
  slug: 'day-trips',
  name: 'Day trips',
  description: null,
  order: 1,
  isActive: true,
  tourCount: 0,
  linkedTourCount: 0,
};

const CRUISES: AdminCategoryRow = {
  ...DAY_TRIPS,
  id: 'c1400001-0000-4000-8000-000000000002',
  slug: 'cruises',
  name: 'Cruises',
  order: 2,
};

/**
 * Một bộ lệnh ghi MỚI — mô phỏng lượt `router.refresh()`: Flight client giải mã server action
 * thành một closure mới mỗi lần, nên trang chở xuống bảng những hàm khác danh tính (review D1).
 */
function freshActions() {
  return {
    create: vi.fn(),
    update: vi.fn(),
    setActive: vi.fn(),
    move: vi.fn(),
    remove: vi.fn(),
  };
}

describe('CategoriesTable — Quick Create', () => {
  it('tới từ trang khác: yêu cầu đang chờ lúc bảng mount → hộp Add category mở sẵn', async () => {
    requestCreate('category');
    render(<CategoriesTable rows={toCategoryRowVMs([DAY_TRIPS])} {...freshActions()} />);
    expect(await screen.findByRole('dialog', { name: t.create.dialog.title })).toBeInTheDocument();
  });

  it('ngay trên trang này: bảng đang mở nghe yêu cầu và mở hộp Add category', async () => {
    render(<CategoriesTable rows={[]} {...freshActions()} />);
    expect(screen.queryByRole('dialog')).toBeNull();

    act(() => requestCreate('category'));
    expect(await screen.findByRole('dialog', { name: t.create.dialog.title })).toBeInTheDocument();
  });

  it('hộp mở bằng yêu cầu, không qua nút: Esc thì focus về nút Add category, không rơi về body (review A2-8)', async () => {
    // Tới từ trang khác: lúc hộp mở, focus đang ở `<body>` — không có nút nào được bấm.
    const user = userEvent.setup();
    requestCreate('category');
    render(<CategoriesTable rows={toCategoryRowVMs([DAY_TRIPS])} {...freshActions()} />);
    await screen.findByRole('dialog', { name: t.create.dialog.title });

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() =>
      expect(screen.getByRole('button', { name: t.create.action })).toHaveFocus(),
    );
  });
});

describe('CategoriesTable — ô hành động sống qua lượt làm mới (review D1)', () => {
  it('làm mới sau IN_USE: lệnh ghi mới, hàng thành có tour — đúng nút Delete ấy còn giữ focus', () => {
    const { rerender } = render(
      <CategoriesTable rows={toCategoryRowVMs([DAY_TRIPS])} {...freshActions()} />,
    );
    const button = screen.getByRole('button', { name: t.delete.actionLabel('Day trips') });
    button.focus();
    expect(button).toHaveFocus();

    // Payload mới đáp xuống: server action khác danh tính, và hàng giờ có 2 tour.
    rerender(
      <CategoriesTable
        rows={toCategoryRowVMs([{ ...DAY_TRIPS, tourCount: 2, linkedTourCount: 2 }])}
        {...freshActions()}
      />,
    );

    const after = screen.getByRole('button', { name: t.delete.actionLabel('Day trips') });
    expect(after).toBe(button);
    expect(after).toHaveFocus();
    expect(after).toHaveAttribute('aria-disabled', 'true');
  });

  it('hộp Edit đang mở trong ô không biến mất khi lệnh ghi đổi danh tính', async () => {
    const user = userEvent.setup();
    const rows = toCategoryRowVMs([DAY_TRIPS]);
    const { rerender } = render(<CategoriesTable rows={rows} {...freshActions()} />);

    await user.click(screen.getByRole('button', { name: t.edit.actionLabel('Day trips') }));
    expect(await screen.findByRole('dialog', { name: t.edit.dialog.title })).toBeInTheDocument();

    rerender(<CategoriesTable rows={rows} {...freshActions()} />);
    expect(screen.getByRole('dialog', { name: t.edit.dialog.title })).toBeInTheDocument();
  });

  it('ô gọi lệnh ghi MỚI NHẤT mà bảng nhận, không giữ bản của lượt trước', async () => {
    // Canh cách vá: cột đứng yên thì ô phải đọc lệnh qua context — một closure chụp lúc dựng
    // cột sẽ gọi mãi bản đầu tiên.
    const user = userEvent.setup();
    const rows = toCategoryRowVMs([DAY_TRIPS]);
    const first = freshActions();
    const { rerender } = render(<CategoriesTable rows={rows} {...first} />);
    const latest = freshActions();
    latest.remove.mockResolvedValue({
      ok: true,
      deleted: { slug: DAY_TRIPS.slug },
    });
    rerender(<CategoriesTable rows={rows} {...latest} />);

    await user.click(screen.getByRole('button', { name: t.delete.actionLabel('Day trips') }));
    const dialog = await screen.findByRole('dialog', { name: t.delete.dialog.title });
    await user.click(within(dialog).getByRole('button', { name: t.delete.dialog.submit }));

    await waitFor(() => expect(latest.remove).toHaveBeenCalledWith({ id: DAY_TRIPS.id }));
    expect(first.remove).not.toHaveBeenCalled();
  });
});

describe('CategoriesTable — focus sau khi xoá (review A2-1)', () => {
  it('xoá thành công rồi lượt làm mới gỡ hàng: focus về nút Add category, không rơi về body', async () => {
    const user = userEvent.setup();
    const actions = freshActions();
    actions.remove.mockResolvedValue({ ok: true, deleted: { slug: DAY_TRIPS.slug } });
    const { rerender } = render(
      <CategoriesTable rows={toCategoryRowVMs([DAY_TRIPS, CRUISES])} {...actions} />,
    );

    await user.click(screen.getByRole('button', { name: t.delete.actionLabel('Day trips') }));
    const dialog = await screen.findByRole('dialog', { name: t.delete.dialog.title });
    await user.click(within(dialog).getByRole('button', { name: t.delete.dialog.submit }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    // Payload mới đáp xuống: hàng vừa xoá rời bảng, kéo theo nút Delete của nó.
    rerender(<CategoriesTable rows={toCategoryRowVMs([CRUISES])} {...freshActions()} />);

    expect(screen.queryByRole('button', { name: t.delete.actionLabel('Day trips') })).toBeNull();
    expect(screen.getByRole('button', { name: t.create.action })).toHaveFocus();
  });

  it('người khác xoá trước (NOT_FOUND) rồi lượt làm mới gỡ hàng: focus về nút Add category, không rơi về body (review G6-F2)', async () => {
    const user = userEvent.setup();
    const actions = freshActions();
    actions.remove.mockResolvedValue({ ok: false, code: 'NOT_FOUND' });
    const { rerender } = render(
      <CategoriesTable rows={toCategoryRowVMs([DAY_TRIPS, CRUISES])} {...actions} />,
    );

    await user.click(screen.getByRole('button', { name: t.delete.actionLabel('Day trips') }));
    const dialog = await screen.findByRole('dialog', { name: t.delete.dialog.title });
    await user.click(within(dialog).getByRole('button', { name: t.delete.dialog.submit }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    // Hàng đã mất ở DB nên lượt làm mới gỡ nó, kéo theo nút Delete của nó — như xoá thành công.
    rerender(<CategoriesTable rows={toCategoryRowVMs([CRUISES])} {...freshActions()} />);

    expect(screen.queryByRole('button', { name: t.delete.actionLabel('Day trips') })).toBeNull();
    expect(screen.getByRole('button', { name: t.create.action })).toHaveFocus();
  });
});
