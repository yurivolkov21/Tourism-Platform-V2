import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { SiteFooter } from './site-footer';

// jsdom không có IntersectionObserver (motion `whileInView`) — stub cục bộ,
// cùng ghi chú với gallery.spec.tsx.
beforeAll(() => {
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

// Mock form newsletter — nó tự kéo api client; footer spec không kiểm form đó.
vi.mock('./newsletter-form', () => ({ NewsletterForm: () => null }));

/**
 * Bản đồ route THẬT của site (app/(site) + app/(auth)) + anchor thật của Home.
 * Footer chỉ được trỏ vào đây — 19/08 user bắt được 'Destinations' → `/#gallery`
 * (trang /destinations đã có từ 30/07) và 4 mục 'Company' → `#top` (trang
 * không tồn tại). Thêm route mới thì thêm vào đây; link footer trỏ ra ngoài
 * danh sách là đỏ ngay, không đợi người dùng bấm phải link chết.
 */
const REAL_TARGETS = new Set([
  '/',
  '/tours',
  '/destinations',
  '/blog',
  '/about',
  '/contact',
  '/faq',
  '/cancellation-policy',
  '/terms',
  '/privacy',
  '/login',
  '/register',
  '/account',
  '/account/bookings',
  '/account/saved',
  '/account/profile',
  '/account/settings',
  '/account/security',
  '/#reviews',
  '/#gallery',
  '/#journal',
  '/#contact',
  '/#tours',
]);

describe('SiteFooter — link phản ánh đúng bản đồ route', () => {
  it('mọi link CHỮ trong ba nhóm + bottom bar trỏ route/anchor CÓ THẬT', () => {
    render(<SiteFooter />);
    // Social icon vẫn là `#top` giữ chỗ (chưa có tài khoản mạng xã hội thật) —
    // loại theo aria-label để không che lỗi của link chữ.
    const SOCIAL = ['Instagram', 'X', 'YouTube', 'Facebook'];
    const textLinks = screen
      .getAllByRole('link')
      .filter((a) => !SOCIAL.includes(a.getAttribute('aria-label') ?? ''));
    expect(textLinks.length).toBeGreaterThan(10);
    for (const a of textLinks) {
      const href = a.getAttribute('href') ?? '';
      expect(REAL_TARGETS.has(href), `${a.textContent} → ${href}`).toBe(true);
    }
  });

  it('có đủ ba nhóm Explore / Your account / Support, và Destinations trỏ /destinations', () => {
    render(<SiteFooter />);
    for (const title of ['Explore', 'Your account', 'Support']) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
    expect(screen.getByRole('link', { name: 'Destinations' })).toHaveAttribute(
      'href',
      '/destinations',
    );
    expect(screen.queryByRole('link', { name: /careers|press|partners|our guides/i })).toBeNull();
  });

  it('bottom bar: Privacy/Terms là LINK, không còn "Cookies" (không có trang)', () => {
    render(<SiteFooter />);
    expect(screen.getAllByRole('link', { name: 'Privacy' }).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByRole('link', { name: 'Terms' }).length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/Cookies/)).toBeNull();
  });
});
