import { render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it, vi } from 'vitest';
import { makeSessionUser } from '@/test/fixtures/account';
import { IdentityCard } from './identity-card';

// `AvatarUpload` bên trong gọi `useRouter` và client oRPC — ở đây không tải ảnh nào.
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/lib/api/client', () => ({
  api: { media: { signUpload: vi.fn() }, account: { setAvatar: vi.fn() } },
  withBrowserAuth: () => ({ auth: { credentials: 'include' } }),
}));

/** Thẻ danh tính — cột trái của Settings (spec 09/10 §2, phương án C). */
const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;

// Nút ảnh tròn mang tên "Upload avatar" bằng `aria-label`; nút viền cùng tên bằng chữ nhìn thấy được.
const photoButton = () => screen.getByLabelText('Upload avatar');

describe('IdentityCard', () => {
  it('ảnh 96px → tên (h2) → email → nút Upload avatar → dòng gợi ý cỡ ảnh, đúng thứ tự', () => {
    render(<IdentityCard profile={makeSessionUser()} />);
    const avatar = photoButton();
    const name = screen.getByRole('heading', { level: 2, name: 'Minh Anh' });
    const email = screen.getByText('minh.anh@example.com');
    const uploadButton = screen.getByText('Upload avatar', { selector: 'button' });
    const hint = screen.getByText(messages.accountProfile.avatar.hint('2 MB'));
    expect(avatar).toHaveClass('size-24');
    expect(name).toHaveClass('font-heading');
    expect(avatar.compareDocumentPosition(name)).toBe(FOLLOWING);
    expect(name.compareDocumentPosition(email)).toBe(FOLLOWING);
    expect(email.compareDocumentPosition(uploadButton)).toBe(FOLLOWING);
    expect(uploadButton.compareDocumentPosition(hint)).toBe(FOLLOWING);
  });

  it('chưa có ảnh: chữ cái đầu của tên; tên trống thì chữ cái đầu của email', () => {
    const { unmount } = render(<IdentityCard profile={makeSessionUser()} />);
    expect(photoButton()).toHaveTextContent('M');
    unmount();
    render(<IdentityCard profile={makeSessionUser({ name: '', email: 'linh@example.com' })} />);
    expect(photoButton()).toHaveTextContent('L');
  });

  it('có ảnh: hiện ảnh đã lưu và nút gỡ ảnh', () => {
    const image = 'https://res.cloudinary.com/demo/avatars/user-1.png';
    const { container } = render(<IdentityCard profile={makeSessionUser({ image })} />);
    expect(container.querySelector('img')).toHaveAttribute('src', image);
    expect(screen.getByRole('button', { name: 'Remove avatar' })).toBeInTheDocument();
  });

  it('dưới vạch ngăn: nhãn nhỏ "Connected accounts" và dòng "Email & password"', () => {
    render(<IdentityCard profile={makeSessionUser()} />);
    const separator = screen.getByRole('separator');
    const label = screen.getByRole('heading', { level: 3, name: 'Connected accounts' });
    expect(separator.compareDocumentPosition(label)).toBe(FOLLOWING);
    expect(screen.getByText('Email & password')).toBeInTheDocument();
  });

  it('nhận className của trang (dính ở lg) và mang móc data-slot cho bố cục', () => {
    const { container } = render(
      <IdentityCard profile={makeSessionUser()} className="lg:sticky lg:top-28" />,
    );
    expect(container.querySelector('[data-slot="identity-card"]')).toHaveClass(
      'rounded-2xl',
      'lg:sticky',
      'lg:top-28',
    );
  });
});
