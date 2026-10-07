import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import type * as React from 'react';
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DeleteRowAction } from './delete-row-action';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

/**
 * Nút Delete của một hàng bảng catalog (spec 2026-10-05 §3.3, ADR-0053 §5): hàng còn tour
 * thì khoá kiểu `aria-disabled` và tooltip nói vì sao; hết tour thì mở hộp xác nhận đỏ.
 */
const COPY = {
  title: 'Delete this category?',
  body: 'No tour uses this category.',
  warning: 'This cannot be undone.',
  submit: 'Delete category',
  submitting: 'Deleting…',
  cancel: 'Cancel',
};

/** Lấy từ `messages` chứ không chép chữ: chữ ghim ở MỘT nơi là spec i18n (review RU2). */
const REASON = messages.admin.categories.delete.inUse(2);

/**
 * Tìm câu lý do trong POPUP tooltip, không theo chữ trần: câu ấy còn nằm trong span `hidden`
 * mà `aria-describedby` của nút trỏ tới (Ruling F-e), nên tìm theo chữ thì luôn thấy span ấy.
 */
const IN_TOOLTIP = { selector: '[data-slot="tooltip-content"]' };

type ActionProps = React.ComponentProps<typeof DeleteRowAction<'IN_USE' | 'NOT_FOUND'>>;

function renderAction(props: Partial<ActionProps> = {}) {
  const onSubmit = vi.fn().mockResolvedValue({
    ok: true,
    toast: { title: 'Category deleted', description: 'Cruises is gone.' },
  });
  const onSettled = vi.fn();
  /** Đích focus sau khi xoá (nút Add của bảng) — đứng SAU nút Delete để Tab đầu vẫn tới Delete. */
  const addButton = createRef<HTMLButtonElement>();
  const element = (next: Partial<ActionProps>) => (
    <>
      <DeleteRowAction<'IN_USE' | 'NOT_FOUND'>
        label="Delete"
        actionLabel="Delete Cruises"
        blockedReason={null}
        disabled={false}
        dialog={{
          copy: COPY,
          rows: [{ label: 'Category', value: 'Cruises' }],
          isStale: () => false,
          errorCopy: () => 'error',
          onSubmit,
        }}
        focusAfterDelete={addButton}
        onSettled={onSettled}
        {...props}
        {...next}
      />
      <button type="button" ref={addButton}>
        Add category
      </button>
    </>
  );
  const { rerender } = render(element({}));
  return {
    onSubmit,
    onSettled,
    button: screen.getByRole('button', { name: 'Delete Cruises' }),
    addButton: screen.getByRole('button', { name: 'Add category' }),
    rerender: (next: Partial<ActionProps>) => rerender(element(next)),
  };
}

/** Bấm Delete rồi bấm một nút trong hộp xác nhận, chờ hộp gỡ hẳn. */
async function answerDialog(button: HTMLElement, choice: string) {
  const user = userEvent.setup();
  await user.click(button);
  const dialog = await screen.findByRole('dialog', { name: COPY.title });
  await user.click(within(dialog).getByRole('button', { name: choice }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
}

describe('DeleteRowAction', () => {
  it('còn tour: nút khoá nhưng vẫn rê được, tooltip nói lý do, bấm không mở hộp', async () => {
    const user = userEvent.setup();
    const { button } = renderAction({ blockedReason: REASON });

    expect(button).toHaveAttribute('aria-disabled', 'true');
    await user.hover(button);
    expect(await screen.findByText(REASON, IN_TOOLTIP)).toBeInTheDocument();
    await user.click(button);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('còn tour: Tab tới nút khoá cũng hiện lý do (spec §3.3 — bàn phím, không chỉ chuột)', async () => {
    const user = userEvent.setup();
    const { button } = renderAction({ blockedReason: REASON });

    // Chưa focus thì chưa có tooltip — chặn ca xanh oan nếu popup luôn nằm sẵn trong DOM.
    expect(screen.queryByText(REASON, IN_TOOLTIP)).toBeNull();
    await user.tab();
    expect(button).toHaveFocus();
    expect(await screen.findByText(REASON, IN_TOOLTIP)).toBeInTheDocument();
  });

  it('còn tour: trình đọc màn hình nghe lý do ngay trên nút, không cần tooltip mở (Ruling F-e)', () => {
    // Tooltip chỉ hiện khi rê hay khi focus, và Base UI không nối popup vào nút bằng
    // `aria-describedby` — thiếu span ẩn thì trình đọc màn hình chỉ nghe "dimmed".
    const { button } = renderAction({ blockedReason: REASON });

    expect(button).toHaveAccessibleDescription(REASON);
    expect(screen.queryByText(REASON, IN_TOOLTIP)).toBeNull();
  });

  it('xoá được thì nút không mang mô tả nào — không có lý do để đọc', () => {
    const { button } = renderAction();

    expect(button).not.toHaveAccessibleDescription();
    expect(button).not.toHaveAttribute('aria-describedby');
  });

  it('lý do khoá đổi lúc nút đang focus (bảng làm mới sau IN_USE): vẫn đúng nút ấy giữ focus', async () => {
    // Bảng cũ hơn DB: bấm Delete → server trả IN_USE → bảng làm mới, hàng nhận
    // `blockedReason`. Nếu cây phần tử đổi kiểu theo `blocked` thì React dựng lại nút và
    // focus rơi về `body` — người dùng bàn phím mất chỗ đang đứng.
    const user = userEvent.setup();
    const { button, rerender } = renderAction();

    await user.tab();
    expect(button).toHaveFocus();
    rerender({ blockedReason: REASON });

    const after = screen.getByRole('button', { name: 'Delete Cruises' });
    expect(after).toBe(button);
    expect(after).toHaveFocus();
    expect(after).toHaveAttribute('aria-disabled', 'true');
  });

  it('còn tour: nút khoá vẫn nhận chuột — đè `aria-disabled:pointer-events-none` của Button', () => {
    const { button } = renderAction({ blockedReason: REASON });

    // jsdom không nạp CSS Tailwind nên ca rê chuột ở trên vẫn xanh cả khi trình duyệt thật
    // nuốt cú rê (`pointer-events: none`) — chỉ class cho thấy chuột có tới được nút không.
    expect(button).toHaveClass('aria-disabled:pointer-events-auto');
    expect(button).not.toHaveClass('aria-disabled:pointer-events-none');
  });

  it('còn tour: rê hay nhấn nút khoá không đổi nền, không nhún — không trông như bấm được', () => {
    // Nhận chuột (ca trên) thì cũng ăn luôn `hover:` và `active:` của biến thể outline: nền
    // `bg-muted` (tối: `bg-input/50`) khi rê và nút nhún 1px khi nhấn. Giữ đúng nền lúc nghỉ
    // của từng giao diện; jsdom không có CSS nên canh lớp, trình duyệt thật đo ở báo cáo.
    const { button } = renderAction({ blockedReason: REASON });

    expect(button).toHaveClass('aria-disabled:hover:bg-background');
    expect(button).toHaveClass('dark:aria-disabled:hover:bg-input/30');
    expect(button).toHaveClass('aria-disabled:active:translate-y-0');
  });

  it('0 tour: mở hộp đỏ, xác nhận thì gửi lệnh rồi làm mới bảng', async () => {
    const user = userEvent.setup();
    const { button, onSubmit, onSettled } = renderAction();

    await user.click(button);
    const dialog = await screen.findByRole('dialog', { name: COPY.title });
    expect(within(dialog).getByText('Cruises')).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: COPY.submit }));

    await waitFor(() => expect(onSettled).toHaveBeenCalled());
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('bảng đang làm mới: nút khoá, không tooltip', () => {
    const { button } = renderAction({ disabled: true });
    expect(button).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('DeleteRowAction — focus khi hộp đóng (review A2-1)', () => {
  it('xoá thành công: focus sang `focusAfterDelete` — hàng sắp rời bảng, kéo theo nút Delete', async () => {
    const { button, addButton } = renderAction();

    await answerDialog(button, COPY.submit);

    await waitFor(() => expect(addButton).toHaveFocus());
  });

  it('huỷ: hàng còn nguyên, focus về đúng nút Delete đã mở hộp', async () => {
    const { button } = renderAction();

    await answerDialog(button, COPY.cancel);

    await waitFor(() => expect(button).toHaveFocus());
  });

  it('lỗi làm hộp đóng (mã trạng-thái-cũ): hàng còn nguyên, focus về nút Delete', async () => {
    const { button } = renderAction({
      dialog: {
        copy: COPY,
        rows: [{ label: 'Category', value: 'Cruises' }],
        isStale: () => true,
        errorCopy: () => 'error',
        onSubmit: vi.fn().mockResolvedValue({ ok: false, code: 'IN_USE' }),
      },
    });

    await answerDialog(button, COPY.submit);

    await waitFor(() => expect(button).toHaveFocus());
  });
});
