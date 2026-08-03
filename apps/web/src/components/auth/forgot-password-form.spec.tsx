import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForgotPasswordForm } from './forgot-password-form';

// Mock authClient — cùng khuôn login-form.spec.tsx.
const { requestPasswordReset } = vi.hoisted(() => ({
  requestPasswordReset: vi.fn(),
}));
vi.mock('@/lib/auth-client', () => ({
  authClient: { requestPasswordReset },
}));

async function submitEmail(user: ReturnType<typeof userEvent.setup>, email: string) {
  await user.type(screen.getByLabelText('Email'), email);
  await user.click(screen.getByRole('button', { name: 'Send the reset link' }));
}

describe('ForgotPasswordForm — anti-enumeration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('resolve {error: null} (email tồn tại) → chuyển state sent', async () => {
    requestPasswordReset.mockResolvedValueOnce({ data: {}, error: null });
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await submitEmail(user, 'minh@example.com');

    expect(await screen.findByText('Check your inbox')).toBeInTheDocument();
  });

  it('email lạ (backend trả error) → VẪN chuyển state sent — cấm nhánh phân biệt', async () => {
    requestPasswordReset.mockResolvedValueOnce({ data: null, error: { status: 404 } });
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await submitEmail(user, 'khong-ton-tai@example.com');

    expect(await screen.findByText('Check your inbox')).toBeInTheDocument();
  });

  it('gọi authClient.requestPasswordReset đúng payload (email + redirectTo)', async () => {
    requestPasswordReset.mockResolvedValueOnce({ data: {}, error: null });
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await submitEmail(user, 'minh@example.com');

    await waitFor(() => expect(requestPasswordReset).toHaveBeenCalledTimes(1));
    expect(requestPasswordReset).toHaveBeenCalledWith({
      email: 'minh@example.com',
      redirectTo: `${window.location.origin}/reset-password`,
    });
  });

  it('lỗi mạng thật sự (promise reject) → hiện lỗi generic inline, KHÔNG sang sent', async () => {
    requestPasswordReset.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    render(<ForgotPasswordForm />);

    await submitEmail(user, 'minh@example.com');

    expect(await screen.findByText(messages.authForms.errors.generic)).toBeInTheDocument();
    expect(screen.queryByText('Check your inbox')).not.toBeInTheDocument();
  });
});
