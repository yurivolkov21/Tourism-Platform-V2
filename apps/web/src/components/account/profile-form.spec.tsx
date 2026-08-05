import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@/lib/api/session';
import { ProfileForm } from './profile-form';

// Mock Better Auth client — spec chỉ kiểm gọi ĐÚNG `updateUser({name, phone})`,
// không gọi BA thật (cùng khuôn `reset-password-form.spec.tsx`).
const { updateUser } = vi.hoisted(() => ({ updateUser: vi.fn() }));
vi.mock('@/lib/auth-client', () => ({ authClient: { updateUser } }));

// Mock next/navigation — `router.refresh()` sau khi lưu thành công.
const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

// Mock sonner — toast CHỈ cho kết quả thành công (spec §5).
const { toastSuccess } = vi.hoisted(() => ({ toastSuccess: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: toastSuccess } }));

const PROFILE: SessionUser = {
  id: 'user-1',
  name: 'Minh Anh',
  email: 'minh.anh@example.com',
  role: 'CUSTOMER',
  phone: '0901234567',
};

describe('ProfileForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sửa tên/phone rồi Save → gọi authClient.updateUser({name, phone}) đúng payload', async () => {
    updateUser.mockResolvedValueOnce({ error: null });
    const user = userEvent.setup();
    render(<ProfileForm profile={PROFILE} />);

    await user.clear(screen.getByLabelText('Full name'));
    await user.type(screen.getByLabelText('Full name'), 'Minh Anh Nguyen');
    await user.clear(screen.getByLabelText('Phone'));
    await user.type(screen.getByLabelText('Phone'), '0909999999');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(updateUser).toHaveBeenCalledWith({ name: 'Minh Anh Nguyen', phone: '0909999999' }),
    );
  });

  it('thành công → toast success + router.refresh()', async () => {
    updateUser.mockResolvedValueOnce({ error: null });
    const user = userEvent.setup();
    render(<ProfileForm profile={PROFILE} />);

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(toastSuccess).toHaveBeenCalledTimes(1));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('lỗi field (vd validate BA) → message inline qua mapAuthError, GIỮ NGUYÊN giá trị đã gõ', async () => {
    updateUser.mockResolvedValueOnce({ error: { status: 422, code: 'VALIDATION' } });
    const user = userEvent.setup();
    render(<ProfileForm profile={PROFILE} />);

    await user.clear(screen.getByLabelText('Full name'));
    await user.type(screen.getByLabelText('Full name'), 'Ten Moi');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText('An account with this email already exists.'),
    ).toBeInTheDocument();
    expect((screen.getByLabelText('Full name') as HTMLInputElement).value).toBe('Ten Moi');
    expect(refresh).not.toHaveBeenCalled();
  });

  it('lỗi mạng thật (promise reject) → generic inline, nút hết pending', async () => {
    updateUser.mockRejectedValueOnce(new Error('network down'));
    const user = userEvent.setup();
    render(<ProfileForm profile={PROFILE} />);

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled();
  });

  it('401 giữa chừng (session hết hạn) → message riêng + link /login?redirect=', async () => {
    updateUser.mockResolvedValueOnce({ error: { status: 401, code: 'UNAUTHORIZED' } });
    const user = userEvent.setup();
    render(<ProfileForm profile={PROFILE} />);

    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Your session has expired.')).toBeInTheDocument();
    const loginLink = screen.getByRole('link', { name: 'Log in again' });
    expect(loginLink).toHaveAttribute('href', '/login?redirect=/account/profile');
    expect(refresh).not.toHaveBeenCalled();
  });
});
