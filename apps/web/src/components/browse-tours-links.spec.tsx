import { render, screen } from '@testing-library/react';
import { aboutPage, contactPage, homePage, resilience } from '@tourism/i18n';
import type { ReactElement, ReactNode } from 'react';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import NotFound from '@/app/not-found';
import { AboutCtaVideo } from './about/about-cta-video';
import { AboutHero } from './about/about-hero';
import { ContactCta } from './contact/contact-cta';
import { CallToAction } from './home/call-to-action';
import { Hero } from './home/hero';

// Vỏ trang (header, footer) của 404 không phải đối tượng của test này.
vi.mock('@/components/site-chrome', () => ({
  SiteChrome: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

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

// Review L8-09 (Yuri chọn "Đổi sang /tours" ngày 21/10): sáu nút mời xem tour từng trỏ `#tours`
// hay `/#tours`, tức khu Stats của trang chủ (chữ, bộ đếm, slider ảnh), không có danh sách tour
// nào. Navbar và footer đã sửa đúng link này sang `/tours` từ 27/07; sáu nút này sót lại.
describe('nút mời xem tour dẫn tới /tours', () => {
  const CASES: [string, () => ReactElement, string][] = [
    ['hero trang chủ', () => <Hero />, homePage.hero.primaryCta],
    ['banner cuối trang chủ', () => <CallToAction />, homePage.callToAction.primaryCta],
    ['hero /about', () => <AboutHero />, aboutPage.hero.browseTours],
    ['khối video /about', () => <AboutCtaVideo />, aboutPage.ctaVideo.browseTours],
    ['khối cuối /contact', () => <ContactCta />, contactPage.cta.browseTours],
    ['trang 404', () => <NotFound />, resilience.notFound.tours],
  ];

  for (const [where, ui, label] of CASES) {
    it(`${where}: "${label}" trỏ /tours`, () => {
      render(ui());
      expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', '/tours');
    });
  }
});
