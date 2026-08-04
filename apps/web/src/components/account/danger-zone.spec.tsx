import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { DangerZone } from './danger-zone';

/**
 * Gate "gõ đúng chữ DELETE mới bật nút" (spec §3, PARK khỏi wiring thật —
 * A2/Task 7 mới nối `DELETE /api/account`). Test này khoá đúng CƠ CHẾ gate,
 * không quan tâm hành động xoá thật.
 */
describe('DangerZone', () => {
  it('mở dialog → nút xác nhận bị khoá (disabled) khi ô gõ còn rỗng', async () => {
    const user = userEvent.setup();
    render(<DangerZone />);
    await user.click(screen.getByRole('button', { name: 'Delete account' }));
    expect(screen.getByRole('button', { name: 'Yes, delete my account' })).toBeDisabled();
  });

  it('gõ sai chữ (thường, thiếu ký tự, thừa ký tự) → nút vẫn khoá', async () => {
    const user = userEvent.setup();
    render(<DangerZone />);
    await user.click(screen.getByRole('button', { name: 'Delete account' }));
    const input = screen.getByRole('textbox');
    const confirmBtn = screen.getByRole('button', { name: 'Yes, delete my account' });

    await user.type(input, 'delete');
    expect(confirmBtn).toBeDisabled();

    await user.clear(input);
    await user.type(input, 'DELET');
    expect(confirmBtn).toBeDisabled();

    await user.clear(input);
    await user.type(input, 'DELETEE');
    expect(confirmBtn).toBeDisabled();
  });

  it('gõ đúng chữ "DELETE" → nút xác nhận bật (không còn disabled)', async () => {
    const user = userEvent.setup();
    render(<DangerZone />);
    await user.click(screen.getByRole('button', { name: 'Delete account' }));
    await user.type(screen.getByRole('textbox'), 'DELETE');
    expect(screen.getByRole('button', { name: 'Yes, delete my account' })).toBeEnabled();
  });
});
