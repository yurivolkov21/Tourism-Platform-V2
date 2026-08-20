import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
      'https://www.nexora-travel.agency/forgot-password',
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

  it('lỗi mạng (reject) → câu chung, không sập', async () => {
    signInEmail.mockRejectedValue(new Error('network'));
    render(<LoginForm />);
    await userEvent.type(screen.getByLabelText('Email'), 'a@b.co');
    await userEvent.type(screen.getByLabelText('Password'), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Something went wrong/);
  });
});
