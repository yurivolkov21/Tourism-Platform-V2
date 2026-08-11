import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { USER_MENU_SIDE_OFFSET, UserMenu } from './user-menu';

// Mock authClient — khuôn mock module giống login-form.spec.tsx: hoisted fn
// cho signOut + useSession riêng, để mỗi test set trạng thái session tuỳ ý
// (session null/pending/có user) mà không cần dựng BA thật.
const { signOut, useSessionMock } = vi.hoisted(() => ({
  signOut: vi.fn(),
  useSessionMock: vi.fn(),
}));
vi.mock('@/lib/auth-client', () => ({
  authClient: { signOut },
  useSession: useSessionMock,
}));

// Mock next/navigation — khuôn giống login-form.spec.tsx.
const { push, refresh } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, refresh }),
}));

/**
 * Task 6 (auth-pages-api): thay hằng session mock module-scope cũ bằng
 * `useSession()` thật — giờ mock được TRUYỀN VÀO qua `useSessionMock`, nên cả
 * hai nhánh (chưa đăng nhập / đã đăng nhập) đều test được, khác giới hạn đã
 * ghi ở bản spec cũ (chỉ canh được nhánh logged-out vì mock là hằng số).
 */
describe('UserMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('session null → render LINK "Log in", không phải dropdown', () => {
    useSessionMock.mockReturnValue({ data: null, isPending: false });
    render(<UserMenu />);
    const link = screen.getByRole('link', { name: /log in/i });
    expect(link).toHaveAttribute('href', '/login');
    expect(screen.queryByRole('button', { name: 'Account' })).not.toBeInTheDocument();
  });

  it('không mở popup nào ở nhánh chưa đăng nhập', async () => {
    useSessionMock.mockReturnValue({ data: null, isPending: false });
    const user = userEvent.setup();
    render(<UserMenu />);
    await user.click(screen.getByRole('link', { name: /log in/i }));
    expect(document.querySelector('[data-slot="dropdown-menu-content"]')).toBeNull();
  });

  // isPending → coi như chưa đăng nhập (render "Log in"), KHÔNG chớp avatar
  // rồi rớt xuống lúc request /get-session chưa xong.
  it('isPending true (dù data đã có sẵn từ lần trước) → vẫn render "Log in"', () => {
    useSessionMock.mockReturnValue({
      data: { user: { name: 'Minh Anh', email: 'minh.anh@example.com' } },
      isPending: true,
    });
    render(<UserMenu />);
    expect(screen.getByRole('link', { name: /log in/i })).toBeInTheDocument();
  });

  it('có session → avatar + tên/email hiện trong dropdown, item trỏ route account thật', async () => {
    useSessionMock.mockReturnValue({
      data: { user: { name: 'Minh Anh', email: 'minh.anh@example.com' } },
      isPending: false,
    });
    const user = userEvent.setup();
    render(<UserMenu />);

    expect(screen.queryByRole('link', { name: /log in/i })).not.toBeInTheDocument();
    const trigger = screen.getByRole('button', { name: 'Account' });
    expect(screen.getByText('M')).toBeInTheDocument(); // AvatarFallback = ký tự đầu tên

    await user.click(trigger);
    expect(await screen.findByText('Minh Anh')).toBeInTheDocument();
    expect(screen.getByText('minh.anh@example.com')).toBeInTheDocument();
    // Task 3 (cụm account, pha A1): hết nợ `#top` — 2 route tĩnh đã dựng.
    // Fix cuối 11/08: "My bookings" đổi thành "Saved tours" → `/account/saved`
    // — "My account" đã là cửa vào bookings (trang hộ chiếu, Your journey).
    expect(screen.getByRole('menuitem', { name: /my account/i })).toHaveAttribute(
      'href',
      '/account',
    );
    expect(screen.getByRole('menuitem', { name: /saved tours/i })).toHaveAttribute(
      'href',
      '/account/saved',
    );
  });

  it('click Sign out → gọi authClient.signOut() rồi push("/") + refresh()', async () => {
    useSessionMock.mockReturnValue({
      data: { user: { name: 'Minh Anh', email: 'minh.anh@example.com' } },
      isPending: false,
    });
    signOut.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();
    render(<UserMenu />);

    await user.click(screen.getByRole('button', { name: 'Account' }));
    await user.click(await screen.findByRole('menuitem', { name: /sign out/i }));

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(push).toHaveBeenCalledWith('/');
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  /**
   * Đo 30/07 (Chromium, session giả có user, cả hai trạng thái cuộn): avatar
   * cao 32px căn giữa hàng cao 40px trong `p-4`, nên dải navbar còn thừa đúng
   * **20px** bên dưới nó. Với `sideOffset` mặc định 4 thì `popup.top −
   * nav.bottom = −16px` — dropdown chui vào navbar, và hit-test giữa vùng
   * chồng cho ra `<nav>`.
   *
   * 20 + 8 = 28. Khác con số 34 của menu Destinations vì trigger ở đó là CHỮ
   * cao 20px, không phải avatar 32px — cùng dải navbar nhưng đệm còn lại khác
   * nhau. Đừng gộp hai hằng số lại làm một.
   */
  it('sideOffset = đệm dải navbar dưới AVATAR cộng khe, không phải mặc định 4', () => {
    expect(USER_MENU_SIDE_OFFSET).toBe(20 + 8);
    // Phải lớn hơn 20, nếu không dropdown vẫn nằm trong dải navbar.
    expect(USER_MENU_SIDE_OFFSET).toBeGreaterThan(20);
  });
});
