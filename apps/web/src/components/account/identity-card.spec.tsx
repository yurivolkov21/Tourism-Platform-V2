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

// Ảnh tròn chỉ để chuột bấm hoặc thả ảnh vào, ẩn khỏi trình đọc màn hình (`aria-hidden`) nên tìm
// bằng thuộc tính; nút có tên "Upload avatar" là nút viền bên dưới tên và email.
const photoButton = (container: HTMLElement) =>
  container.querySelector('button[aria-hidden="true"]') as HTMLButtonElement;

describe('IdentityCard', () => {
  it('ảnh 96px → tên (h2) → email → nút Upload avatar → dòng gợi ý cỡ ảnh, đúng thứ tự', () => {
    const { container } = render(<IdentityCard profile={makeSessionUser()} />);
    const avatar = photoButton(container);
    const name = screen.getByRole('heading', { level: 2, name: 'Minh Anh' });
    const email = screen.getByText('minh.anh@example.com');
    const uploadButton = screen.getByRole('button', { name: 'Upload avatar' });
    const hint = screen.getByText(messages.accountProfile.avatar.hint('2 MB'));
    expect(avatar).toHaveClass('size-24');
    expect(name).toHaveClass('font-heading');
    expect(avatar.compareDocumentPosition(name)).toBe(FOLLOWING);
    expect(name.compareDocumentPosition(email)).toBe(FOLLOWING);
    expect(email.compareDocumentPosition(uploadButton)).toBe(FOLLOWING);
    expect(uploadButton.compareDocumentPosition(hint)).toBe(FOLLOWING);
  });

  it('chưa có ảnh: chữ cái đầu của tên; tên trống thì chữ cái đầu của email', () => {
    const first = render(<IdentityCard profile={makeSessionUser()} />);
    expect(photoButton(first.container)).toHaveTextContent('M');
    first.unmount();
    const second = render(
      <IdentityCard profile={makeSessionUser({ name: '', email: 'linh@example.com' })} />,
    );
    expect(photoButton(second.container)).toHaveTextContent('L');
  });

  it('tên rỗng: KHÔNG dựng h2 rỗng (trình đọc màn hình đọc ra một đề mục trống); email vẫn hiện', () => {
    render(<IdentityCard profile={makeSessionUser({ name: '', email: 'linh@example.com' })} />);
    expect(screen.queryByRole('heading', { level: 2 })).not.toBeInTheDocument();
    // Email nhận luôn khoảng cách mà tên chiếm (mt-3 dưới ảnh), kẻo dính sát ảnh.
    expect(screen.getByText('linh@example.com')).toHaveClass('mt-3');
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

  it('email dài và tên một từ dài bẻ dòng TRONG thẻ: `wrap-anywhere` trên email và h2', () => {
    // jsdom không có bố cục nên ca này chỉ khoá class; số đo thật (trang 320px không cuộn ngang, email
    // nằm trong viền thẻ ở 1024px) đo bằng trình duyệt thật. `break-words` KHÔNG đủ: nó không hạ
    // min-content của ô flex nên thẻ phình theo email, đẩy cả trang cuộn ngang (320px) hay thò ra
    // khỏi viền thẻ (cột trái 320px từ lg); `overflow-wrap: anywhere` mới hạ min-content.
    const email = 'nguyen.thi.minh.anh.phuong.traveller@example.com';
    const name = 'Nguyễnthịminhanhphươngnguyễnthịminh';
    render(<IdentityCard profile={makeSessionUser({ name, email })} />);
    expect(screen.getByText(email)).toHaveClass('wrap-anywhere');
    expect(screen.getByRole('heading', { level: 2, name })).toHaveClass('wrap-anywhere');
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
