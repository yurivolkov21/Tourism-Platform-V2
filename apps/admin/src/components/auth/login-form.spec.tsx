import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { webUrl } from '@/lib/site';
import { LoginForm, validateAdminLogin } from './login-form';

// Mock authClient — form chỉ được gọi khi validate client qua hết.
const signInEmail = vi.fn();
vi.mock('@/lib/auth-client', () => ({
  authClient: { signIn: { email: (...args: unknown[]) => signInEmail(...args) } },
}));

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
  useSearchParams: () => new URLSearchParams('redirect=/outbox'),
}));

beforeEach(() => {
  signInEmail.mockReset();
  push.mockReset();
  refresh.mockReset();
});

describe('validateAdminLogin (thuần)', () => {
  it('rỗng cả hai → hai lỗi theo field', () => {
    const e = validateAdminLogin('', '');
    expect(e.email).toMatch(/Enter your email/);
    expect(e.password).toMatch(/Enter your password/);
  });

  it('email sai định dạng → lỗi định dạng; mật khẩu chỉ cần khác rỗng', () => {
    const e = validateAdminLogin('not-an-email', 'x');
    expect(e.email).toMatch(/valid email/);
    expect(e.password).toBeUndefined();
  });
});

describe('LoginForm', () => {
  it('form noValidate — KHÔNG dựa HTML validation (nếp toàn dự án)', () => {
    const { container } = render(<LoginForm />);
    expect(container.querySelector('form')).toHaveAttribute('novalidate');
    expect(container.querySelector('[required]')).toBeNull();
  });

  it('submit rỗng → lỗi per-field, KHÔNG gọi API', async () => {
    render(<LoginForm />);
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByText(/Enter your email/)).toBeInTheDocument();
    expect(screen.getByText(/Enter your password/)).toBeInTheDocument();
    expect(signInEmail).not.toHaveBeenCalled();
  });

  it('sai credentials (code CHÍNH XÁC) → câu riêng', async () => {
    signInEmail.mockResolvedValue({ error: { code: 'INVALID_EMAIL_OR_PASSWORD' } });
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co');
    await userEvent.type(screen.getByLabelText('Password'), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Incorrect email or password/);
    expect(push).not.toHaveBeenCalled();
  });

  it('thành công → push đúng redirect param (đã qua safeRedirect) + refresh', async () => {
    signInEmail.mockResolvedValue({ error: null });
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co');
    await userEvent.type(screen.getByLabelText('Password'), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(push).toHaveBeenCalledWith('/outbox');
    expect(refresh).toHaveBeenCalled();
  });

  it('nút 👁 đảo type input mật khẩu (wireframe auth-1)', async () => {
    render(<LoginForm />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('type', 'password');
    await userEvent.click(screen.getByRole('button', { name: /show password/i }));
    expect(input).toHaveAttribute('type', 'text');
    await userEvent.click(screen.getByRole('button', { name: /hide password/i }));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('link Forgot password trỏ flow của www, không phải route admin', () => {
    render(<LoginForm />);
    expect(screen.getByRole('link', { name: /forgot password/i })).toHaveAttribute(
      'href',
      `${webUrl()}/forgot-password`,
    );
  });

  it('EMAIL_NOT_VERIFIED (siết 20/08) → chỉ dẫn verify bên www, không câu chung', async () => {
    signInEmail.mockResolvedValue({ error: { code: 'EMAIL_NOT_VERIFIED' } });
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co');
    await userEvent.type(screen.getByLabelText('Password'), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Verify your email/i);
    expect(push).not.toHaveBeenCalled();
  });

  it('tài khoản bị khoá (ACCOUNT_LOCKED) → câu riêng bảo hỏi Owner', async () => {
    signInEmail.mockResolvedValue({ error: { code: 'ACCOUNT_LOCKED' } });
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co');
    await userEvent.type(screen.getByLabelText('Password'), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      messages.admin.login.errors.accountLocked,
    );
    expect(push).not.toHaveBeenCalled();
  });

  it('quá trần đăng nhập (429) → câu bảo chờ, không câu chung mời thử lại ngay (L1-12)', async () => {
    // Better Auth chặn quá ba lần đăng nhập trong mười giây; lỗi của nó mang status, mã thì tuỳ bản.
    signInEmail.mockResolvedValue({ error: { status: 429, message: 'Too many requests' } });
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co');
    await userEvent.type(screen.getByLabelText('Password'), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      messages.admin.login.errors.tooManyAttempts,
    );
    expect(push).not.toHaveBeenCalled();
  });

  it('lỗi mạng (reject) → câu chung, không sập', async () => {
    signInEmail.mockRejectedValue(new Error('network'));
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co');
    await userEvent.type(screen.getByLabelText('Password'), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Something went wrong/);
  });
});

describe('LoginForm — focus lúc đang đăng nhập', () => {
  async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByLabelText('Email'), 'a@b.co');
    await user.type(screen.getByLabelText('Password'), 'secret123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));
  }

  it('nút Sign in khoá kiểu aria-disabled và GIỮ focus; sai mật khẩu thì focus vẫn ở nút', async () => {
    let finish: (value: { error: { code: string } }) => void = () => {};
    signInEmail.mockReturnValue(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const user = userEvent.setup();
    render(<LoginForm />);

    await fillAndSubmit(user);

    const button = screen.getByRole('button', { name: messages.admin.login.submitting });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).not.toHaveAttribute('disabled');
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(signInEmail).toHaveBeenCalledTimes(1);

    finish({ error: { code: 'INVALID_EMAIL_OR_PASSWORD' } });
    expect(
      await screen.findByText(messages.admin.login.errors.invalidCredentials),
    ).toBeInTheDocument();
    expect(button).toHaveAccessibleName(messages.admin.login.submit);
    expect(button).not.toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveFocus();
  });

  it('Enter trong ô mật khẩu lúc đang chờ không gửi lần hai', async () => {
    signInEmail.mockReturnValue(new Promise(() => {}));
    const user = userEvent.setup();
    render(<LoginForm />);

    await fillAndSubmit(user);
    await user.type(screen.getByLabelText('Password'), '{Enter}');

    expect(signInEmail).toHaveBeenCalledTimes(1);
  });
});
