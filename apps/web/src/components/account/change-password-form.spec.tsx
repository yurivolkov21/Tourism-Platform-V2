import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChangePasswordForm } from './change-password-form';

// Mock Better Auth client — cùng khuôn `reset-password-form.spec.tsx`.
const { changePassword } = vi.hoisted(() => ({ changePassword: vi.fn() }));
vi.mock('@/lib/auth-client', () => ({ authClient: { changePassword } }));

// Mock sonner — toast CHỈ cho kết quả thành công (spec §5).
const { toastSuccess } = vi.hoisted(() => ({ toastSuccess: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: toastSuccess } }));

async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  {
    current = 'OldPassw0rd!',
    next = 'NewPassw0rd!23',
    confirm = 'NewPassw0rd!23',
  }: { current?: string; next?: string; confirm?: string } = {},
) {
  await user.type(screen.getByLabelText('Current password'), current);
  await user.type(screen.getByLabelText('New password'), next);
  await user.type(screen.getByLabelText('Confirm new password'), confirm);
  await user.click(screen.getByRole('button', { name: 'Update password' }));
}

describe('ChangePasswordForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('điền đủ 3 field khớp nhau → gọi authClient.changePassword({currentPassword, newPassword}) đúng payload', async () => {
    changePassword.mockResolvedValueOnce({ error: null });
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await fillAndSubmit(user);

    await waitFor(() =>
      expect(changePassword).toHaveBeenCalledWith({
        currentPassword: 'OldPassw0rd!',
        newPassword: 'NewPassw0rd!23',
      }),
    );
  });

  it('confirm KHÔNG khớp new → lỗi inline "do not match", KHÔNG gọi API', async () => {
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await fillAndSubmit(user, { confirm: 'KhacHan123!' });

    expect(
      await screen.findByText('New password and confirmation do not match.'),
    ).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('thành công → toast success, form reset (3 field rỗng lại)', async () => {
    changePassword.mockResolvedValueOnce({ error: null });
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await fillAndSubmit(user);

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
    expect((screen.getByLabelText('Current password') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('New password') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Confirm new password') as HTMLInputElement).value).toBe('');
  });

  it('sai mật khẩu hiện tại (BA INVALID_PASSWORD) → message inline, KHÔNG mất giá trị đã gõ', async () => {
    changePassword.mockResolvedValueOnce({
      error: { status: 400, code: 'INVALID_PASSWORD' },
    });
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await fillAndSubmit(user, { current: 'SaiRoi123!' });

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
    expect((screen.getByLabelText('Current password') as HTMLInputElement).value).toBe(
      'SaiRoi123!',
    );
  });

  it('lỗi mạng thật (promise reject) → generic inline, nút hết pending', async () => {
    changePassword.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await fillAndSubmit(user);

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update password' })).toBeEnabled();
  });

  it('401 giữa chừng (session hết hạn) → message riêng + link /login?redirect=', async () => {
    changePassword.mockResolvedValueOnce({ error: { status: 401, code: 'UNAUTHORIZED' } });
    const user = userEvent.setup();
    render(<ChangePasswordForm />);

    await fillAndSubmit(user);

    expect(await screen.findByText('Your session has expired.')).toBeInTheDocument();
    const loginLink = screen.getByRole('link', { name: 'Log in again' });
    expect(loginLink).toHaveAttribute('href', '/login?redirect=/account/profile');
  });
});
