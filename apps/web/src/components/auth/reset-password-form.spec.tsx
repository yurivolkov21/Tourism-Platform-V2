import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResetPasswordForm } from './reset-password-form';

// Mock authClient — cùng khuôn login-form.spec.tsx.
const { resetPassword } = vi.hoisted(() => ({
  resetPassword: vi.fn(),
}));
vi.mock('@/lib/auth-client', () => ({
  authClient: { resetPassword },
}));

// Mock sonner — chỉ cần soi có gọi toast.success không, không kiểm UI thật.
const { toastSuccess } = vi.hoisted(() => ({ toastSuccess: vi.fn() }));
vi.mock('sonner', () => ({
  toast: { success: toastSuccess },
}));

// Mock next/navigation — reset-password đọc `token` qua useSearchParams, push
// sau khi thành công.
const { push, searchParamsGet } = vi.hoisted(() => ({
  push: vi.fn(),
  searchParamsGet: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  useSearchParams: () => ({ get: searchParamsGet }),
}));

describe('ResetPasswordForm — token thiếu/rỗng', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('thiếu ?token= → panel lỗi thân thiện + link /forgot-password, KHÔNG render form', async () => {
    searchParamsGet.mockReturnValue(null);
    render(<ResetPasswordForm />);

    expect(
      screen.getByText(messages.authForms.resetPassword.invalidToken.heading),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Request a new link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    expect(screen.queryByLabelText('New password')).not.toBeInTheDocument();
  });

  it('token rỗng chuỗi → cùng panel lỗi', async () => {
    searchParamsGet.mockReturnValue('');
    render(<ResetPasswordForm />);

    expect(
      screen.getByText(messages.authForms.resetPassword.invalidToken.heading),
    ).toBeInTheDocument();
  });
});

describe('ResetPasswordForm — submit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsGet.mockReturnValue('reset-token-abc');
  });

  async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText('New password'), 'Sup3r$ecret');
    await user.click(screen.getByRole('button', { name: 'Save and board again' }));
  }

  it('hợp lệ → gọi authClient.resetPassword đúng payload (newPassword + token)', async () => {
    resetPassword.mockResolvedValueOnce({ data: {}, error: null });
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await fillAndSubmit(user);

    await waitFor(() => expect(resetPassword).toHaveBeenCalledTimes(1));
    expect(resetPassword).toHaveBeenCalledWith({
      newPassword: 'Sup3r$ecret',
      token: 'reset-token-abc',
    });
  });

  it('thành công → toast success + push("/login")', async () => {
    resetPassword.mockResolvedValueOnce({ data: {}, error: null });
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await fillAndSubmit(user);

    await waitFor(() => expect(push).toHaveBeenCalledWith('/login'));
    expect(toastSuccess).toHaveBeenCalledTimes(1);
  });

  it('lỗi mạng thật (promise reject từ resetPassword) → hiện errors.generic, nút hết pending', async () => {
    resetPassword.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    const submitButton = screen.getByRole('button', { name: 'Save and board again' });
    await fillAndSubmit(user);

    expect(await screen.findByText(messages.authForms.errors.generic)).toBeInTheDocument();
    expect(submitButton).not.toBeDisabled();
    expect(push).not.toHaveBeenCalled();
  });

  it('token hỏng (mock error code TOKEN) → text invalidToken hiện inline, KHÔNG push', async () => {
    resetPassword.mockResolvedValueOnce({ data: null, error: { code: 'INVALID_TOKEN' } });
    const user = userEvent.setup();
    render(<ResetPasswordForm />);

    await fillAndSubmit(user);

    expect(await screen.findByText(messages.authForms.errors.invalidToken)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});
