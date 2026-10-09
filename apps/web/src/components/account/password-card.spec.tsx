import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeSessionUser } from '@/test/fixtures/account';
import { PasswordCard } from './password-card';
import { ProfileSummary } from './profile-summary';

const { updateUser, changePassword } = vi.hoisted(() => ({
  updateUser: vi.fn(),
  changePassword: vi.fn(),
}));
vi.mock('@/lib/auth-client', () => ({ authClient: { updateUser, changePassword } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const { toastSuccess } = vi.hoisted(() => ({ toastSuccess: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: toastSuccess } }));

beforeEach(() => {
  vi.clearAllMocks();
  updateUser.mockResolvedValue({ error: null });
  changePassword.mockResolvedValue({ error: null });
});

/** Thẻ Password tách khỏi Personal information (spec 09/10 §2). */
describe('PasswordCard', () => {
  it('tiêu đề "Password", mô tả, MỘT dòng mật khẩu che chấm tròn CỐ ĐỊNH và nút Edit', () => {
    render(<PasswordCard />);
    expect(screen.getByRole('heading', { level: 2, name: 'Password' })).toBeInTheDocument();
    expect(screen.getByText('Change the password you sign in with.')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    // Hiện đúng số ký tự là rò rỉ một mẩu thông tin về mật khẩu.
    expect(screen.getByText('••••••••••')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Password' })).toBeInTheDocument();
  });

  it('bấm Edit → form ba ô nằm TRONG dòng của thẻ; GIỮ ô "Current password" (Better Auth bắt buộc)', async () => {
    const user = userEvent.setup();
    render(<PasswordCard />);
    await user.click(screen.getByRole('button', { name: 'Edit Password' }));
    const item = screen.getByLabelText('Current password').closest('li');
    expect(item).toHaveClass('bg-primary/5');
    expect(item).toContainElement(screen.getByLabelText('New password'));
    expect(item).toContainElement(screen.getByLabelText('Confirm new password'));
    expect(screen.queryByText('••••••••••')).not.toBeInTheDocument();
  });

  it('đổi mật khẩu xong thì ĐÓNG dòng lại — để mở với ba ô rỗng trông như chưa lưu', async () => {
    const user = userEvent.setup();
    render(<PasswordCard />);
    await user.click(screen.getByRole('button', { name: 'Edit Password' }));
    await user.type(screen.getByLabelText('Current password'), 'OldPass!2026');
    await user.type(screen.getByLabelText('New password'), 'NewPass!2026');
    await user.type(screen.getByLabelText('Confirm new password'), 'NewPass!2026');
    await user.click(screen.getByRole('button', { name: 'Update password' }));

    await waitFor(() => expect(changePassword).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: 'Edit Password' })).toBeInTheDocument();
  });

  it('Cancel → về tĩnh, KHÔNG gọi changePassword', async () => {
    const user = userEvent.setup();
    render(<PasswordCard />);
    await user.click(screen.getByRole('button', { name: 'Edit Password' }));
    await user.type(screen.getByLabelText('Current password'), 'OldPass!2026');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByLabelText('Current password')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Password' })).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('mở cùng lúc với dòng tên của Personal information — mỗi thẻ giữ trạng thái mở riêng', async () => {
    const user = userEvent.setup();
    render(
      <>
        <ProfileSummary profile={makeSessionUser()} />
        <PasswordCard />
      </>,
    );
    await user.click(screen.getByRole('button', { name: 'Edit Full name' }));
    await user.click(screen.getByRole('button', { name: 'Edit Password' }));
    expect(screen.getByRole('textbox', { name: 'Full name' })).toHaveValue('Minh Anh');
    expect(screen.getByLabelText('Current password')).toBeInTheDocument();
  });
});
