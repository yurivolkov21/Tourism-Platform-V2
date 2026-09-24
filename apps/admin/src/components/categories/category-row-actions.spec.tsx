import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminCategoryRow } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { toCategoryRowVMs } from '@/lib/categories-view';
import { CategoryRowActions } from './category-row-actions';

/**
 * Bốn nút của một hàng bảng danh mục (spec P4e-2 F14). Phần đáng pin là chuyện
 * nút nào ĐƯỢC BẤM, vì đó là nơi luật server hiện ra thành giao diện:
 *
 *  ① hàng đầu không lên được, hàng cuối không xuống được — gương của
 *    `CANNOT_MOVE`, và mời bấm là mời ăn một 409;
 *  ② hộp xác nhận ẨN phải nói đủ BA hệ quả, vì thứ admin hay đoán nhầm nhất
 *    là tưởng ẩn danh mục thì ẩn luôn tour trong đó.
 */

const t = messages.admin.categories;

const success = vi.fn();
const errorToast = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => success(...args),
    error: (...args: unknown[]) => errorToast(...args),
  },
}));

const row = (n: number, over: Partial<AdminCategoryRow> = {}): AdminCategoryRow => ({
  id: `c1400001-0000-4000-8000-${String(n).padStart(12, '0')}`,
  slug: `cat-${n}`,
  name: `Category ${n}`,
  description: null,
  order: n,
  isActive: true,
  tourCount: 0,
  ...over,
});

/** Dựng một hàng ở vị trí `index` trong danh sách `rows`. */
function renderRow(rows: AdminCategoryRow[], index: number, over: Record<string, unknown> = {}) {
  const vm = toCategoryRowVMs(rows)[index];
  if (!vm) throw new Error(`no row at ${index}`);
  const update = vi.fn();
  const setActive = vi.fn(async () => ({
    ok: true as const,
    row: rows[index] as AdminCategoryRow,
  }));
  const move = vi.fn(async () => ({ ok: true as const, rows }));
  const onMoveStart = vi.fn();
  render(
    <CategoryRowActions
      row={vm}
      update={update}
      setActive={setActive}
      move={move}
      disabled={false}
      onMoveStart={onMoveStart}
      onSettled={vi.fn()}
      {...over}
    />,
  );
  return { vm, update, setActive, move, onMoveStart };
}

beforeEach(() => {
  success.mockReset();
  errorToast.mockReset();
});

describe('CategoryRowActions — nút nào được bấm', () => {
  it('hàng GIỮA đi được cả hai chiều', () => {
    const { vm } = renderRow([row(1), row(2), row(3)], 1);

    expect(screen.getByRole('button', { name: t.move.upLabel(vm.name) })).toBeEnabled();
    expect(screen.getByRole('button', { name: t.move.downLabel(vm.name) })).toBeEnabled();
  });

  it('hàng ĐẦU: nút lên TẮT — server sẽ trả CANNOT_MOVE, mời bấm là mời ăn lỗi', () => {
    const { vm } = renderRow([row(1), row(2)], 0);

    expect(screen.getByRole('button', { name: t.move.upLabel(vm.name) })).toBeDisabled();
    expect(screen.getByRole('button', { name: t.move.downLabel(vm.name) })).toBeEnabled();
  });

  it('hàng CUỐI: nút xuống TẮT', () => {
    const { vm } = renderRow([row(1), row(2)], 1);

    expect(screen.getByRole('button', { name: t.move.downLabel(vm.name) })).toBeDisabled();
  });

  it('bảng đang bận: khoá HẾT, và bấm vào cũng không gửi gì', async () => {
    // Khẳng định `move` chưa được gọi chỉ có nghĩa khi ĐÃ bấm: bản đầu của ca
    // này không click lần nào nên nó xanh kể cả khi `disabled` bị bỏ qua hoàn
    // toàn (vòng review F14).
    const user = userEvent.setup();
    const { vm, move } = renderRow([row(1), row(2)], 0, { disabled: true });
    const down = screen.getByRole('button', { name: t.move.downLabel(vm.name) });
    const edit = screen.getByRole('button', { name: t.edit.actionLabel(vm.name) });

    // Nút mở hộp thoại khoá bằng `aria-disabled` để vẫn nhận focus (vòng review
    // F15); mũi tên không mở hộp thoại nào nên giữ `disabled` thật.
    expect(edit).toHaveAttribute('aria-disabled', 'true');
    expect(edit).not.toHaveAttribute('disabled');
    expect(down).toBeDisabled();

    await user.click(down);
    await user.click(edit);

    expect(move).not.toHaveBeenCalled();
    expect(screen.queryByText(t.edit.dialog.title)).not.toBeInTheDocument();
  });

  it('bấm xuống gửi đúng hướng và đúng id', async () => {
    const user = userEvent.setup();
    const { vm, move } = renderRow([row(1), row(2)], 0);

    await user.click(screen.getByRole('button', { name: t.move.downLabel(vm.name) }));

    await waitFor(() => expect(move).toHaveBeenCalledWith({ id: vm.id, direction: 'down' }));
  });

  it('báo bảng bận NGAY khi bấm, trước cả khi lệnh về', async () => {
    // Đây là nửa client của bản vá đua `order`: nếu cờ bận chỉ bật sau khi
    // response về, thì giữa hai mốc ấy mũi tên của HÀNG KHÁC vẫn bấm được và
    // một admin bấm nhanh bắn được hai lệnh chồng nhau.
    const user = userEvent.setup();
    let resolveMove: (() => void) | undefined;
    const move = vi.fn(
      () =>
        new Promise<{ ok: true; rows: AdminCategoryRow[] }>((resolve) => {
          resolveMove = () => resolve({ ok: true, rows: [] });
        }),
    );
    const { vm, onMoveStart } = renderRow([row(1), row(2)], 0, { move });

    await user.click(screen.getByRole('button', { name: t.move.downLabel(vm.name) }));

    // Lệnh còn đang bay — cha đã phải biết là bảng đang bận.
    expect(onMoveStart).toHaveBeenCalledTimes(1);
    resolveMove?.();
  });
});

describe('CategoryRowActions — hộp xác nhận ẩn danh mục', () => {
  it('in tên, SỐ TOUR, và nói đủ ba hệ quả', async () => {
    const user = userEvent.setup();
    const { vm } = renderRow([row(1, { name: 'Day trips', tourCount: 7 }), row(2)], 0);

    await user.click(screen.getByRole('button', { name: t.setActive.hideLabel(vm.name) }));

    expect(await screen.findByText(t.setActive.dialog.hideTitle)).toBeInTheDocument();
    expect(screen.getByText(t.setActive.rows.tours)).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    // Câu cảnh báo là thứ ngăn admin hiểu nhầm rằng ẩn danh mục là ẩn tour.
    expect(screen.getByText(t.setActive.dialog.hideWarning)).toBeInTheDocument();
  });

  it('câu cảnh báo mang giọng TRUNG TÍNH, không tô đỏ', async () => {
    // Lượt thử tay F14 (23/09): câu này là câu TRẤN AN — tour vẫn bán, link
    // vẫn chạy — mà kit tô đỏ mặc định, nên màu nói ngược với chữ.
    const user = userEvent.setup();
    const { vm } = renderRow([row(1), row(2)], 0);

    await user.click(screen.getByRole('button', { name: t.setActive.hideLabel(vm.name) }));

    expect(await screen.findByText(t.setActive.dialog.hideWarning)).toHaveAttribute(
      'data-tone',
      'neutral',
    );
  });

  it('hàng ĐÃ ẨN: nút đổi thành Hiện và câu cảnh báo đổi theo', async () => {
    const user = userEvent.setup();
    const { vm } = renderRow([row(1, { isActive: false }), row(2)], 0);

    await user.click(screen.getByRole('button', { name: t.setActive.showLabel(vm.name) }));

    expect(await screen.findByText(t.setActive.dialog.showTitle)).toBeInTheDocument();
    expect(screen.getByText(t.setActive.dialog.showWarning)).toBeInTheDocument();
  });

  it('xác nhận: gửi cờ NGƯỢC với trạng thái hiện tại, toast đọc TỪ RESPONSE', async () => {
    const user = userEvent.setup();
    const rows = [row(1, { name: 'Day trips' }), row(2)];
    // Response KHÁC request (một admin khác vừa đổi tên): mock phản chiếu đúng
    // request thì ca này không phân biệt được toast dựng từ response với toast
    // dựng từ hàng đang hiện (vòng review F15).
    const setActive = vi.fn(async () => ({
      ok: true as const,
      row: { ...(rows[0] as AdminCategoryRow), isActive: false, name: 'Short trips' },
    }));
    const { vm } = renderRow(rows, 0, { setActive });

    await user.click(screen.getByRole('button', { name: t.setActive.hideLabel(vm.name) }));
    await user.click(await screen.findByRole('button', { name: t.setActive.dialog.hideSubmit }));

    await waitFor(() => expect(setActive).toHaveBeenCalledWith({ id: vm.id, isActive: false }));
    expect(success).toHaveBeenCalledWith(t.setActive.toast.hiddenTitle, {
      description: t.setActive.toast.hiddenBody('Short trips'),
    });
  });
});

describe('CategoryRowActions — form sửa', () => {
  it('mở form sửa với tên hiện tại, và KHÔNG có ô slug', async () => {
    const user = userEvent.setup();
    const { vm } = renderRow([row(1, { name: 'Day trips' }), row(2)], 0);

    await user.click(screen.getByRole('button', { name: t.edit.actionLabel(vm.name) }));

    expect(await screen.findByText(t.edit.dialog.title)).toBeInTheDocument();
    expect(screen.getByLabelText(t.form.name)).toHaveValue('Day trips');
    expect(screen.queryByLabelText(t.form.slug)).not.toBeInTheDocument();
  });

  it('ô mô tả nạp bản THÔ — kể cả khi nó trùng câu thay thế', async () => {
    // Danh mục có mô tả thật đúng bằng câu "chưa có mô tả" là ca hiểm: đọc bản
    // hiển thị rồi so chuỗi sẽ mở ra ô trống, và lưu một phát là mất mô tả.
    const user = userEvent.setup();
    const { vm } = renderRow([row(1, { description: t.list.inherited }), row(2)], 0);

    await user.click(screen.getByRole('button', { name: t.edit.actionLabel(vm.name) }));

    expect(await screen.findByLabelText(t.form.description)).toHaveValue(t.list.inherited);
  });

  it('ô mô tả TRỐNG khi danh mục chưa có mô tả', async () => {
    const user = userEvent.setup();
    const { vm } = renderRow([row(1), row(2)], 0);

    await user.click(screen.getByRole('button', { name: t.edit.actionLabel(vm.name) }));

    expect(await screen.findByLabelText(t.form.description)).toHaveValue('');
  });
});
