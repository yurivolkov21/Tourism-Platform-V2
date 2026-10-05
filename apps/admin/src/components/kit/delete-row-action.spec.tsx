import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type * as React from 'react';
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

function renderAction(
  props: Partial<React.ComponentProps<typeof DeleteRowAction<'IN_USE' | 'NOT_FOUND'>>> = {},
) {
  const onSubmit = vi.fn().mockResolvedValue({
    ok: true,
    toast: { title: 'Category deleted', description: 'Cruises is gone.' },
  });
  const onSettled = vi.fn();
  render(
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
      onSettled={onSettled}
      {...props}
    />,
  );
  return { onSubmit, onSettled, button: screen.getByRole('button', { name: 'Delete Cruises' }) };
}

describe('DeleteRowAction', () => {
  it('còn tour: nút khoá nhưng vẫn rê được, tooltip nói lý do, bấm không mở hộp', async () => {
    const user = userEvent.setup();
    const { button } = renderAction({ blockedReason: 'Used by 2 tours — hide it instead.' });

    expect(button).toHaveAttribute('aria-disabled', 'true');
    await user.hover(button);
    expect(await screen.findByText('Used by 2 tours — hide it instead.')).toBeInTheDocument();
    await user.click(button);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('còn tour: Tab tới nút khoá cũng hiện lý do (spec §3.3 — bàn phím, không chỉ chuột)', async () => {
    const user = userEvent.setup();
    const { button } = renderAction({ blockedReason: 'Used by 2 tours — hide it instead.' });

    // Chưa focus thì chưa có tooltip — chặn ca xanh oan nếu popup luôn nằm sẵn trong DOM.
    expect(screen.queryByText('Used by 2 tours — hide it instead.')).toBeNull();
    await user.tab();
    expect(button).toHaveFocus();
    expect(await screen.findByText('Used by 2 tours — hide it instead.')).toBeInTheDocument();
  });

  it('còn tour: nút khoá vẫn nhận chuột — đè `aria-disabled:pointer-events-none` của Button', () => {
    const { button } = renderAction({ blockedReason: 'Used by 2 tours — hide it instead.' });

    // jsdom không nạp CSS Tailwind nên ca rê chuột ở trên vẫn xanh cả khi trình duyệt thật
    // nuốt cú rê (`pointer-events: none`) — chỉ class cho thấy chuột có tới được nút không.
    expect(button).toHaveClass('aria-disabled:pointer-events-auto');
    expect(button).not.toHaveClass('aria-disabled:pointer-events-none');
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
