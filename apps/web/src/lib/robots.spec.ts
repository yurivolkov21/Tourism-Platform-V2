import { describe, expect, it } from 'vitest';
import { robotsFor } from './robots';

// ADR-0016 AMEND 2 — robots theo HOST request: chỉ www thật mở crawl; preview
// Vercel/apex/dev đóng (nội dung trùng với production). Không còn phụ thuộc
// VERCEL_ENV lúc build (promote/rollback preview từng có thể đóng prod).
const SITE_HOST = 'www.nexora-travel.agency';

describe('robotsFor', () => {
  it('host trùng site: allow / + disallow các khu private + sitemap', () => {
    const robots = robotsFor({ requestHost: SITE_HOST, siteHost: SITE_HOST });
    expect(robots.rules).toEqual({
      userAgent: '*',
      allow: '/',
      disallow: ['/account/', '/checkout/', '/api/'],
    });
    expect(robots.sitemap).toMatch(/\/sitemap\.xml$/);
  });

  it('so host không phân biệt hoa thường', () => {
    expect(
      robotsFor({ requestHost: 'WWW.Nexora-Travel.agency', siteHost: SITE_HOST }).rules,
    ).toHaveProperty('allow', '/');
  });

  it("preview *.vercel.app, apex, localhost: disallow '/' toàn bộ, KHÔNG sitemap", () => {
    for (const requestHost of [
      'tourism-v2-git-fix-x.vercel.app',
      'nexora-travel.agency',
      'localhost:3000',
    ]) {
      const robots = robotsFor({ requestHost, siteHost: SITE_HOST });
      expect(robots.rules).toEqual({ userAgent: '*', disallow: '/' });
      expect(robots.sitemap).toBeUndefined();
    }
  });

  it('thiếu header host → đóng (fail-closed)', () => {
    expect(robotsFor({ requestHost: null, siteHost: SITE_HOST }).rules).toEqual({
      userAgent: '*',
      disallow: '/',
    });
  });
});
