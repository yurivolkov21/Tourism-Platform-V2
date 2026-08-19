import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SiteHeader } from './site-header';

// Navbar kéo theo UserMenu (session) + DestinationsMenu + theme toggler — mock
// mỏng những thứ cần mạng/DOM thật; spec này chỉ canh ĐÍCH của các control.
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock('@/lib/auth-client', () => ({
  useSession: () => ({ data: null, isPending: false }),
  authClient: { signOut: vi.fn() },
}));
vi.mock('./destinations-menu', () => ({ DestinationsMenu: () => null }));
vi.mock('@tourism/ui/components/animated-theme-toggler', () => ({
  AnimatedThemeToggler: () => null,
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
