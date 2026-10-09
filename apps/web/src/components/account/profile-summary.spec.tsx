import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeSessionUser } from '@/test/fixtures/account';
import { ProfileSummary } from './profile-summary';

const { updateUser } = vi.hoisted(() => ({ updateUser: vi.fn() }));
vi.mock('@/lib/auth-client', () => ({ authClient: { updateUser } }));

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const { toastSuccess } = vi.hoisted(() => ({ toastSuccess: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: toastSuccess } }));

const PROFILE = makeSessionUser();

beforeEach(() => {
  vi.clearAllMocks();
  updateUser.mockResolvedValue({ error: null });
});

describe('ProfileSummary — thẻ Personal information (spec 09/10 §2)', () => {
  it('tiêu đề h2, mô tả, đúng ba dòng Full name · Phone · Email — mật khẩu đã sang thẻ riêng', () => {
    render(<ProfileSummary profile={PROFILE} />);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Personal information' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Your name and contact details.')).toBeInTheDocument();
    expect(
      screen.getAllByRole('listitem').map((item) => item.querySelector('p')?.textContent),
    ).toEqual(['Full name', 'Phone', 'Email']);
    expect(screen.queryByText('••••••••••')).not.toBeInTheDocument();
  });

  it('mặc định KHÔNG có ô nhập nào — trang này để XEM là chính', () => {
    render(<ProfileSummary profile={PROFILE} />);
    expect(screen.getByText('Minh Anh')).toBeInTheDocument();
    expect(screen.getByText('0901234567')).toBeInTheDocument();
    expect(screen.getByText('minh.anh@example.com')).toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('gợi ý của Phone hiện ngay cả khi chưa sửa', () => {
    render(<ProfileSummary profile={PROFILE} />);
    expect(screen.getByText('So the guide can reach you on the day.')).toBeInTheDocument();
  });

  it('email KHÔNG có nút sửa — nói thẳng "chưa đổi được"', () => {
    render(<ProfileSummary profile={PROFILE} />);
    expect(screen.getByText('Can’t be changed yet')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit Email' })).not.toBeInTheDocument();
  });

  it('phone rỗng → "Not set", không phải ô trống trơn', () => {
    render(<ProfileSummary profile={{ ...PROFILE, phone: null }} />);
    expect(screen.getByText('Not set')).toBeInTheDocument();
  });
});

describe('ProfileSummary — sửa từng dòng', () => {
  // Sweep 19/08: tên trống / phone ngắn bắt ở client, không gọi updateUser.
  it('xoá trắng tên rồi Save → required inline, KHÔNG gọi updateUser', async () => {
    const user = userEvent.setup();
    render(<ProfileSummary profile={PROFILE} />);
    await user.click(screen.getByRole('button', { name: 'Edit Full name' }));
    await user.clear(screen.getByRole('textbox'));
    await user.click(screen.getByRole('button', { name: 'Save name' }));

    expect(await screen.findByText(messages.formErrors.name.required)).toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('phone 3 ký tự → phone.invalid inline, KHÔNG gọi updateUser', async () => {
    const user = userEvent.setup();
    render(<ProfileSummary profile={PROFILE} />);
    await user.click(screen.getByRole('button', { name: 'Edit Phone' }));
    await user.clear(screen.getByRole('textbox'));
    await user.type(screen.getByRole('textbox'), '123');
    await user.click(screen.getByRole('button', { name: 'Save phone' }));

    expect(await screen.findByText(messages.formErrors.phone.invalid)).toBeInTheDocument();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it('bấm Edit ở dòng tên → mở ĐÚNG một ô nhập', async () => {
    const user = userEvent.setup();
    render(<ProfileSummary profile={PROFILE} />);
    await user.click(screen.getByRole('button', { name: 'Edit Full name' }));
    expect(screen.getAllByRole('textbox')).toHaveLength(1);
  });

  it('dòng đang sửa tô nền nhạt; ô nhập và Save/Cancel nằm TRONG dòng đó', async () => {
    const user = userEvent.setup();
    render(<ProfileSummary profile={PROFILE} />);
    await user.click(screen.getByRole('button', { name: 'Edit Phone' }));
    const item = screen.getByRole('textbox', { name: 'Phone' }).closest('li');
    expect(item).toHaveClass('bg-primary/5');
    expect(item).toContainElement(screen.getByRole('button', { name: 'Save phone' }));
    expect(item).toContainElement(screen.getByRole('button', { name: 'Cancel' }));
  });

  it('mở dòng khác thì dòng đang mở ĐÓNG lại — trong thẻ mỗi lúc chỉ một', async () => {
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
