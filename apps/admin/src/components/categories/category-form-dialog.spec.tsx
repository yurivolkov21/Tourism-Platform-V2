import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminCategoryRow } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CategoryFormDialog } from './category-form-dialog';

/**
 * Form THÊM và SỬA một danh mục (spec P4e-2 F14).
 *
 * Phần đáng pin nhất là ô SLUG, vì nó mang trọn một quyết định của spec §2c:
 * đặt được một lần lúc tạo, rồi khoá vĩnh viễn — slug đi vào URL công khai dạng
 * tham số truy vấn, mà tham số truy vấn thì không chuyển hướng được.
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

const SAVED: AdminCategoryRow = {
  id: 'c1400001-0000-4000-8000-000000000001',
  slug: 'day-trips',
  name: 'Day trips',
  description: null,
  order: 1,
  isActive: true,
  tourCount: 3,
};

function renderDialog(
  props: Partial<React.ComponentProps<typeof CategoryFormDialog<'SLUG_TAKEN'>>> = {},
) {
  const onSubmit = props.onSubmit ?? vi.fn(async () => ({ ok: true as const, row: SAVED }));
  const onClose = props.onClose ?? vi.fn();
  const onSettled = props.onSettled ?? vi.fn();
  render(
    <CategoryFormDialog<'SLUG_TAKEN'>
      copy={t.create.dialog}
      formId="category-create"
      mode="create"
      initial={{ name: '', slug: '', description: '' }}
      isStale={() => false}
      errorCopy={() => t.create.errors.SLUG_TAKEN}
      toast={() => ({ title: t.create.toast.title, description: 'done' })}
      {...props}
      onSubmit={onSubmit}
      onClose={onClose}
      onSettled={onSettled}
    />,
  );
  return { onSubmit, onClose, onSettled };
}

beforeEach(() => {
  success.mockReset();
  errorToast.mockReset();
});

describe('CategoryFormDialog — ô slug', () => {
  it('chế độ TẠO: ô slug có mặt và sửa được', () => {
    renderDialog();

    expect(screen.getByLabelText(t.form.slug)).toBeEnabled();
  });

  it('ô slug KHÔNG bị soát chính tả hay tự sửa chữ', () => {
    // Lượt thử tay F14 (23/09): trình duyệt gạch chân đỏ `dao-phu-quoc` như
    // một lỗi chính tả. Slug không phải câu văn — soát chính tả chỉ gây nhiễu,
    // còn tự viết hoa hay tự sửa chữ trên bàn phím điện thoại thì làm hỏng nó.
    renderDialog();
    const slug = screen.getByLabelText(t.form.slug);

    expect(slug).toHaveAttribute('spellcheck', 'false');
    expect(slug).toHaveAttribute('autocapitalize', 'none');
    expect(slug).toHaveAttribute('autocorrect', 'off');
  });

  it('chế độ SỬA: ô slug KHÔNG có mặt — đây là chốt của "đặt một lần"', () => {
    // Để ô đó ở đây dưới dạng disabled cũng không đủ: nó mời người ta thử, rồi
    // phải giải thích. Không render mới là câu trả lời gọn.
    renderDialog({
      mode: 'edit',
      copy: t.edit.dialog,
      initial: { name: 'Day trips', slug: 'day-trips', description: '' },
    });

    expect(screen.queryByLabelText(t.form.slug)).not.toBeInTheDocument();
    expect(screen.getByLabelText(t.form.name)).toBeEnabled();
  });

  it('gõ TÊN thì slug tự điền theo — bỏ dấu tiếng Việt', () => {
    // Đây là chỗ `slugifyVietnamese` gặp người dùng.
    const user = userEvent.setup();
    renderDialog();

    return (async () => {
      await user.type(screen.getByLabelText(t.form.name), 'Đà Lạt');
      expect(screen.getByLabelText(t.form.slug)).toHaveValue('da-lat');
    })();
  });

  it('admin sửa tay ô slug rồi thì gõ tên KHÔNG ghi đè nữa', async () => {
    // Tự điền là tiện; ghi đè thứ người ta vừa cố ý gõ là cướp quyền. Đo trên
    // production: slug thật do người chọn (`Hà Nội` → `hanoi`).
    const user = userEvent.setup();
    renderDialog();

    const slug = screen.getByLabelText(t.form.slug);
    await user.type(screen.getByLabelText(t.form.name), 'Ha Long');
    await user.clear(slug);
    await user.type(slug, 'halong');
    await user.type(screen.getByLabelText(t.form.name), ' Bay');

    expect(slug).toHaveValue('halong');
  });

  it('slug sai khuôn báo tại ô, KHÔNG gọi server', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog();

    await user.type(screen.getByLabelText(t.form.name), 'X');
    await user.clear(screen.getByLabelText(t.form.slug));
    await user.type(screen.getByLabelText(t.form.slug), 'KHONG HOP LE');
    await user.click(screen.getByRole('button', { name: t.create.dialog.submit }));

    expect(await screen.findByText(t.form.errors.slugShape)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('bấm Enter trong một ô là GỬI form', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderDialog({
      initial: { name: 'Day trips', slug: 'day-trips', description: '' },
    });

    await user.click(screen.getByLabelText(t.form.name));
    await user.keyboard('{Enter}');

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  });

  it('ô nhập trỏ tới gợi ý của nó bằng `aria-describedby`', () => {
    renderDialog();

    const slug = screen.getByLabelText(t.form.slug);
    const id = slug.getAttribute('aria-describedby');
    expect(document.getElementById(id as string)?.textContent).toBe(t.form.slugHint);
  });
});
