import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SessionUser } from '@/lib/api/session';
import { ProfileSummary } from './profile-summary';

const { updateUser, changePassword } = vi.hoisted(() => ({
  updateUser: vi.fn(),
  changePassword: vi.fn(),
}));
vi.mock('@/lib/auth-client', () => ({ authClient: { updateUser, changePassword } }));

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { toastSuccess } = vi.hoisted(() => ({ toastSuccess: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: toastSuccess } }));

const PROFILE: SessionUser = {
  id: 'user-1',
  name: 'Minh Anh',
  email: 'minh.anh@example.com',
  role: 'CUSTOMER',
  phone: '0901234567',
};

beforeEach(() => {
  vi.clearAllMocks();
  updateUser.mockResolvedValue({ error: null });
  changePassword.mockResolvedValue({ error: null });
});

describe('ProfileSummary — đọc trước, sửa sau', () => {
  it('mặc định KHÔNG có ô nhập nào — trang này để XEM là chính', () => {
    render(<ProfileSummary profile={PROFILE} />);
    expect(screen.getByText('Minh Anh')).toBeInTheDocument();
    expect(screen.getByText('0901234567')).toBeInTheDocument();
    expect(screen.getByText('minh.anh@example.com')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('email KHÔNG có nút đổi — nói thẳng "chưa đổi được" thay vì dựng nút rồi báo lỗi', () => {
    render(<ProfileSummary profile={PROFILE} />);
    expect(screen.getByText('Can’t be changed yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /change email/i })).not.toBeInTheDocument();
  });

  it('mật khẩu hiện chấm tròn CỐ ĐỊNH, không theo độ dài thật', () => {
    // Hiện đúng số ký tự là rò rỉ một mẩu thông tin về mật khẩu.
    render(<ProfileSummary profile={PROFILE} />);
    expect(screen.getByText('••••••••••')).toBeInTheDocument();
  });

  it('phone rỗng → "Not set", không phải ô trống trơn', () => {
    render(<ProfileSummary profile={{ ...PROFILE, phone: null }} />);
    expect(screen.getByText('Not set')).toBeInTheDocument();
  });
});

describe('ProfileSummary — sửa từng dòng', () => {
  it('bấm Edit ở dòng tên → mở ĐÚNG một ô nhập', async () => {
    const user = userEvent.setup();
    render(<ProfileSummary profile={PROFILE} />);
    await user.click(screen.getByRole('button', { name: 'Edit Full name' }));
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });

  it('mở dòng khác thì dòng đang mở ĐÓNG lại — mỗi lúc chỉ một', async () => {
    // Mở nhiều dòng cùng lúc thì không rõ nút Save nào thuộc về đâu.
    const user = userEvent.setup();
    render(<ProfileSummary profile={PROFILE} />);
    await user.click(screen.getByRole('button', { name: 'Edit Full name' }));
    await user.click(screen.getByRole('button', { name: 'Edit Phone' }));
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Save phone' })).toBeInTheDocument();
  });

  it('lưu tên gửi CHỈ field đó, không gửi kèm phone', async () => {
    const user = userEvent.setup();
    render(<ProfileSummary profile={PROFILE} />);
    await user.click(screen.getByRole('button', { name: 'Edit Full name' }));
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'Minh Anh Nguyễn');
    await user.click(screen.getByRole('button', { name: 'Save name' }));

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ name: 'Minh Anh Nguyễn' }));
    expect(toastSuccess).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('Cancel TRẢ LẠI giá trị đã lưu — chữ gõ dở không được giữ lại', async () => {
    // Mở lại mà vẫn thấy chữ vừa gõ thì người dùng tưởng nó đã được lưu.
    const user = userEvent.setup();
    render(<ProfileSummary profile={PROFILE} />);
    await user.click(screen.getByRole('button', { name: 'Edit Full name' }));
    await user.type(screen.getByRole('textbox'), ' TẠM');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Edit Full name' }));
    expect(screen.getByRole('textbox')).toHaveValue('Minh Anh');
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('401 giữa chừng → message riêng + link đăng nhập lại, KHÔNG auto-signout', async () => {
    updateUser.mockResolvedValueOnce({ error: { status: 401 } });
    const user = userEvent.setup();
    render(<ProfileSummary profile={PROFILE} />);
    await user.click(screen.getByRole('button', { name: 'Edit Phone' }));
    await user.click(screen.getByRole('button', { name: 'Save phone' }));

    expect(await screen.findByText('Your session has expired.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Log in again' })).toHaveAttribute(
      'href',
      '/login?redirect=/account/profile',
    );
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe('ProfileSummary — dòng mật khẩu', () => {
  it('GIỮ field "Current password" — bắt buộc của Better Auth', async () => {
    // Gộp hoặc bỏ field này là mutation chết.
    const user = userEvent.setup();
    render(<ProfileSummary profile={PROFILE} />);
    await user.click(screen.getByRole('button', { name: 'Edit Password' }));
    expect(screen.getByLabelText(/current password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^new password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm/i)).toBeInTheDocument();
  });

  it('đổi mật khẩu xong thì ĐÓNG dòng lại', async () => {
    const user = userEvent.setup();
    render(<ProfileSummary profile={PROFILE} />);
    await user.click(screen.getByRole('button', { name: 'Edit Password' }));
    await user.type(screen.getByLabelText(/current password/i), 'OldPass!2026');
    await user.type(screen.getByLabelText(/^new password/i), 'NewPass!2026');
    await user.type(screen.getByLabelText(/confirm/i), 'NewPass!2026');
    await user.click(screen.getByRole('button', { name: /update password|save/i }));

    await waitFor(() => expect(changePassword).toHaveBeenCalled());
    // Để mở với ba ô rỗng trông như chưa lưu.
    await waitFor(() =>
      expect(screen.queryByLabelText(/current password/i)).not.toBeInTheDocument(),
    );
  });

  it('Cancel dòng mật khẩu → về tĩnh, KHÔNG gọi changePassword', async () => {
    // Đồng bộ hành vi Cancel với dòng tên/phone — nở ra rồi phải đóng lại
    // được mà không cần lưu.
    const user = userEvent.setup();
    render(<ProfileSummary profile={PROFILE} />);
    await user.click(screen.getByRole('button', { name: 'Edit Password' }));
    await user.type(screen.getByLabelText(/current password/i), 'OldPass!2026');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByLabelText(/current password/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Password' })).toBeInTheDocument();
    expect(changePassword).not.toHaveBeenCalled();
  });
});
