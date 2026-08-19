import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RegisterForm } from './register-form';

// Mock authClient — cùng khuôn login-form.spec.tsx.
const { signUpEmail, signInSocial } = vi.hoisted(() => ({
  signUpEmail: vi.fn(),
  signInSocial: vi.fn(),
}));
vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signUp: { email: signUpEmail },
    signIn: { social: signInSocial },
  },
}));

// Mock next/navigation — register-form chỉ cần push (không refresh: rời trang
// sang /verify-email chờ OTP, không có state trang cũ cần làm mới).
const { push, searchParamsGet } = vi.hoisted(() => ({
  push: vi.fn(),
  searchParamsGet: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
  useSearchParams: () => ({ get: searchParamsGet }),
}));

async function fillValidRegistration(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Full name'), 'Minh Anh');
  await user.type(screen.getByLabelText('Email'), 'minh@example.com');
  await user.type(screen.getByLabelText('Password'), 'Sup3r$ecret');
  await user.click(screen.getByRole('checkbox', { name: /Terms/i }));
}

describe('RegisterForm — gate Terms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsGet.mockReturnValue(null);
  });

  it('chưa tick Terms → nút submit bị disabled, không gọi API dù click', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText('Full name'), 'Minh Anh');
    await user.type(screen.getByLabelText('Email'), 'minh@example.com');
    await user.type(screen.getByLabelText('Password'), 'Sup3r$ecret');

    expect(screen.getByRole('button', { name: 'Create my account' })).toBeDisabled();
    expect(signUpEmail).not.toHaveBeenCalled();
  });
});

describe('RegisterForm — submit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsGet.mockReturnValue(null);
  });

  // Sweep bắt lỗi form 19/08.
  it('tick Terms rồi submit trống → ba lỗi required riêng, KHÔNG gọi API', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Create my account' }));

    expect(await screen.findByText(messages.formErrors.name.required)).toBeInTheDocument();
    expect(screen.getByText(messages.formErrors.email.required)).toBeInTheDocument();
    expect(screen.getByText(messages.formErrors.password.required)).toBeInTheDocument();
    expect(signUpEmail).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Email').closest('form')).toHaveAttribute('novalidate');
  });

  it('mật khẩu 7 ký tự → tooShort dưới ô mật khẩu, KHÔNG gọi API', async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.type(screen.getByLabelText('Full name'), 'Tran Mai Anh');
    await user.type(screen.getByLabelText('Email'), 'anh@example.com');
    await user.type(screen.getByLabelText('Password'), 'short7!');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Create my account' }));

    expect(await screen.findByText(messages.formErrors.password.tooShort)).toBeInTheDocument();
    expect(signUpEmail).not.toHaveBeenCalled();
  });

  it('hợp lệ + tick Terms → gọi authClient.signUp.email đúng payload', async () => {
    signUpEmail.mockResolvedValueOnce({ data: { user: { id: '1' } }, error: null });
    const user = userEvent.setup();
    render(<RegisterForm />);

    await fillValidRegistration(user);
    await user.click(screen.getByRole('button', { name: 'Create my account' }));

    await waitFor(() => expect(signUpEmail).toHaveBeenCalledTimes(1));
    expect(signUpEmail).toHaveBeenCalledWith({
      name: 'Minh Anh',
      email: 'minh@example.com',
      password: 'Sup3r$ecret',
    });
  });

  it('thành công → push "/verify-email?email=…" đúng địa chỉ đã đăng ký', async () => {
    signUpEmail.mockResolvedValueOnce({ data: { user: { id: '1' } }, error: null });
    const user = userEvent.setup();
    render(<RegisterForm />);

    await fillValidRegistration(user);
    await user.click(screen.getByRole('button', { name: 'Create my account' }));

    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/verify-email?email=minh%40example.com'),
    );
  });

  it('lỗi mạng thật (promise reject từ signUp.email) → hiện errors.generic, nút hết pending', async () => {
    signUpEmail.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    render(<RegisterForm />);

    await fillValidRegistration(user);
    const submitButton = screen.getByRole('button', { name: 'Create my account' });
    await user.click(submitButton);

    expect(await screen.findByText(messages.authForms.errors.generic)).toBeInTheDocument();
    expect(submitButton).not.toBeDisabled();
    expect(push).not.toHaveBeenCalled();
  });

  it('422 emailExists → text lỗi i18n hiện inline, KHÔNG push', async () => {
    signUpEmail.mockResolvedValueOnce({ data: null, error: { status: 422 } });
    const user = userEvent.setup();
    render(<RegisterForm />);

    await fillValidRegistration(user);
    await user.click(screen.getByRole('button', { name: 'Create my account' }));

    expect(await screen.findByText(messages.authForms.errors.emailExists)).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });
});

describe('RegisterForm — Google', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsGet.mockReturnValue(null);
  });

  it('Google lỗi (chưa cấu hình) → text "notAvailable" hiện inline', async () => {
    signInSocial.mockResolvedValueOnce({ data: null, error: { status: 404 } });
    const user = userEvent.setup();
    render(<RegisterForm />);

    await user.click(screen.getByRole('button', { name: /Continue with Google/i }));

    expect(await screen.findByText(messages.authForms.errors.notAvailable)).toBeInTheDocument();
  });
});
