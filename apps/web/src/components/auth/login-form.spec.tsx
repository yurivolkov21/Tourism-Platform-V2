import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginForm } from './login-form';

// Mock authClient — spec chỉ kiểm submit gọi ĐÚNG method/payload, không gọi
// API thật (cùng khuôn mock client với contact-split.spec.tsx).
const { signInEmail, signInSocial } = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  signInSocial: vi.fn(),
}));
vi.mock('@/lib/auth-client', () => ({
  authClient: {
    signIn: { email: signInEmail, social: signInSocial },
  },
}));

// Mock next/navigation — khuôn giống load-error-state.spec.tsx, thêm
// useSearchParams vì login-form đọc `redirect` để safe-redirect sau đăng nhập.
const { push, refresh, searchParamsGet } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  searchParamsGet: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => ({ get: searchParamsGet }),
}));

async function fillCredentials(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Email'), 'minh@example.com');
  await user.type(screen.getByLabelText('Password'), 'Sup3r$ecret');
}

describe('LoginForm — submit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsGet.mockReturnValue(null);
  });

  it('hợp lệ → gọi authClient.signIn.email đúng payload', async () => {
    signInEmail.mockResolvedValueOnce({ data: { user: { id: '1' } }, error: null });
    const user = userEvent.setup();
    render(<LoginForm />);

    await fillCredentials(user);
    await user.click(screen.getByRole('button', { name: 'Board the trip' }));

    await waitFor(() => expect(signInEmail).toHaveBeenCalledTimes(1));
    expect(signInEmail).toHaveBeenCalledWith({
      email: 'minh@example.com',
      password: 'Sup3r$ecret',
      rememberMe: false,
    });
  });

  it('thành công → push đúng đích theo safeRedirect(redirect) rồi refresh', async () => {
    signInEmail.mockResolvedValueOnce({ data: { user: { id: '1' } }, error: null });
    searchParamsGet.mockReturnValue('/account');
    const user = userEvent.setup();
    render(<LoginForm />);

    await fillCredentials(user);
    await user.click(screen.getByRole('button', { name: 'Board the trip' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/account'));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('redirect param không an toàn (open-redirect) → push fallback "/" (safeRedirect chặn)', async () => {
    signInEmail.mockResolvedValueOnce({ data: { user: { id: '1' } }, error: null });
    searchParamsGet.mockReturnValue('//evil.com');
    const user = userEvent.setup();
    render(<LoginForm />);

    await fillCredentials(user);
    await user.click(screen.getByRole('button', { name: 'Board the trip' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/'));
  });

  it('401 invalidCredentials → text lỗi i18n hiện inline, KHÔNG push', async () => {
    signInEmail.mockResolvedValueOnce({ data: null, error: { status: 401 } });
    const user = userEvent.setup();
    render(<LoginForm />);

    await fillCredentials(user);
    await user.click(screen.getByRole('button', { name: 'Board the trip' }));

    expect(
      await screen.findByText(messages.authForms.errors.invalidCredentials),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('remember me tick → payload rememberMe: true', async () => {
    signInEmail.mockResolvedValueOnce({ data: { user: { id: '1' } }, error: null });
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole('checkbox', { name: 'Remember me' }));
    await fillCredentials(user);
    await user.click(screen.getByRole('button', { name: 'Board the trip' }));

    await waitFor(() =>
      expect(signInEmail).toHaveBeenCalledWith({
        email: 'minh@example.com',
        password: 'Sup3r$ecret',
        rememberMe: true,
      }),
    );
  });
});

describe('LoginForm — Google', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchParamsGet.mockReturnValue(null);
  });

  it('nút Google gọi authClient.signIn.social đúng provider + callbackURL', async () => {
    signInSocial.mockResolvedValueOnce({ data: null, error: null });
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole('button', { name: /Continue with Google/i }));

    await waitFor(() => expect(signInSocial).toHaveBeenCalledTimes(1));
    expect(signInSocial).toHaveBeenCalledWith({
      provider: 'google',
      callbackURL: `${window.location.origin}/`,
    });
  });

  it('Google lỗi (chưa cấu hình) → text "notAvailable" hiện inline', async () => {
    signInSocial.mockResolvedValueOnce({ data: null, error: { status: 501 } });
    const user = userEvent.setup();
    render(<LoginForm />);

    await user.click(screen.getByRole('button', { name: /Continue with Google/i }));

    expect(await screen.findByText(messages.authForms.errors.notAvailable)).toBeInTheDocument();
  });
});
