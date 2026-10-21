import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SiteHeader } from './site-header';

// Session và đường dẫn đổi được theo từng ca (menu điện thoại đọc cả hai).
const state = vi.hoisted(() => ({
  pathname: '/',
  session: { data: null, isPending: false } as {
    data: { user: { name: string; email: string; image: string | null } } | null;
    isPending: boolean;
  },
}));

// Navbar kéo theo UserMenu (session) + DestinationsMenu + theme toggler — mock
// mỏng những thứ cần mạng/DOM thật; spec này chỉ canh ĐÍCH của các control.
vi.mock('next/navigation', () => ({
  usePathname: () => state.pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/lib/auth-client', () => ({
  useSession: () => state.session,
  authClient: { signOut: vi.fn() },
}));

afterEach(() => {
  state.pathname = '/';
  state.session = { data: null, isPending: false };
});

/** Lớp phủ menu điện thoại — nút mở trỏ tới nó qua `aria-controls`. */
function mobileMenu() {
  const id = screen.getByRole('button', { name: 'Open menu' }).getAttribute('aria-controls');
  const overlay = id ? document.getElementById(id) : null;
  if (!overlay) throw new Error('không tìm thấy lớp phủ menu điện thoại');
  return overlay;
}
vi.mock('./destinations-menu', () => ({ DestinationsMenu: () => null }));
// Bản giả chỉ in nhãn mà header truyền vào, để canh chữ của nút đổi theme đi qua i18n.
vi.mock('@tourism/ui/components/animated-theme-toggler', () => ({
  AnimatedThemeToggler: ({ label }: { label: string }) => <button type="button">{label}</button>,
}));

describe('SiteHeader — mọi control là đích thật', () => {
  // 19/08 user báo: "Book a tour" bấm không đi đâu — là `<button>` static-first
  // không handler. Nay là LINK tới catalogue; test khoá để không quay lại nút chết.
  it('"Book a tour" là link tới /tours', () => {
    render(<SiteHeader />);
    const cta = screen.getByRole('link', { name: 'Book a tour' });
    expect(cta).toHaveAttribute('href', '/tours');
    expect(screen.queryByRole('button', { name: 'Book a tour' })).toBeNull();
  });

  // Hai nút đổi theme (thanh desktop và thanh điện thoại) nhận nhãn từ `messages.a11y`.
  it('nút đổi theme mang nhãn của i18n ở cả hai thanh', () => {
    render(<SiteHeader />);
    expect(screen.getAllByRole('button', { name: 'Toggle theme' })).toHaveLength(2);
  });

  it('4 link chính trỏ route thật', () => {
    render(<SiteHeader />);
    for (const [name, href] of [
      ['Tours', '/tours'],
      ['Travel Blog', '/blog'],
      ['About Us', '/about'],
      ['Contact', '/contact'],
    ] as const) {
      expect(screen.getAllByRole('link', { name })[0]).toHaveAttribute('href', href);
    }
  });
});

describe('SiteHeader — menu điện thoại', () => {
  // Desktop và footer đã trỏ /destinations từ khi trang ấy dựng (30/07); riêng menu
  // điện thoại còn trỏ /tours.
  it('Destinations trỏ /destinations như desktop và footer', () => {
    render(<SiteHeader />);
    expect(within(mobileMenu()).getByRole('link', { name: 'Destinations' })).toHaveAttribute(
      'href',
      '/destinations',
    );
  });

  it('chưa đăng nhập: "Log in" mang theo trang đang xem', () => {
    state.pathname = '/tours';
    render(<SiteHeader />);
    const menu = within(mobileMenu());
    expect(menu.getByRole('link', { name: 'Log in' })).toHaveAttribute(
      'href',
      '/login?redirect=%2Ftours',
    );
    expect(menu.queryByRole('link', { name: 'My account' })).toBeNull();
  });

  // Trước đây menu điện thoại luôn hiện "Log in", kể cả khi đã đăng nhập, và không có
  // lối nào vào trang tài khoản (desktop có avatar, điện thoại thì không).
  it('đã đăng nhập: "My account" tới /account thay cho "Log in"', () => {
    state.session = {
      data: { user: { name: 'Emma', email: 'emma@example.com', image: null } },
      isPending: false,
    };
    render(<SiteHeader />);
    const menu = within(mobileMenu());
    expect(menu.getByRole('link', { name: 'My account' })).toHaveAttribute('href', '/account');
    expect(menu.queryByRole('link', { name: 'Log in' })).toBeNull();
  });

  // Lớp phủ đóng chỉ co về bề rộng 0, link bên trong vẫn nhận Tab: người dùng bàn phím
  // đi qua sáu link vô hình (đo bằng Playwright ở 390px).
  it('đóng thì inert (ra khỏi thứ tự Tab), mở thì gỡ inert', () => {
    render(<SiteHeader />);
    const open = screen.getByRole('button', { name: 'Open menu' });
    expect(open).toHaveAttribute('aria-expanded', 'false');
    expect(mobileMenu()).toHaveAttribute('inert');

    fireEvent.click(open);
    expect(open).toHaveAttribute('aria-expanded', 'true');
    expect(mobileMenu()).not.toHaveAttribute('inert');

    fireEvent.click(within(mobileMenu()).getByRole('button', { name: 'Close menu' }));
    expect(mobileMenu()).toHaveAttribute('inert');
  });
});
