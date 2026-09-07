import { describe, expect, it } from 'vitest';
import { robotsFor } from './robots';

// ADR-0016 AMEND 1 §7 — robots theo môi trường: preview Vercel/apex không
// được crawl (nội dung trùng với production), production giữ rule cũ.
describe('robotsFor', () => {
  it('production: allow / + disallow các khu private + sitemap', () => {
    const robots = robotsFor('production');
    expect(robots.rules).toEqual({
      userAgent: '*',
      allow: '/',
      disallow: ['/account/', '/checkout/', '/api/'],
    });
    expect(robots.sitemap).toMatch(/\/sitemap\.xml$/);
  });

  it("preview: disallow '/' toàn bộ, KHÔNG sitemap", () => {
    const robots = robotsFor('preview');
    expect(robots.rules).toEqual({ userAgent: '*', disallow: '/' });
    expect(robots.sitemap).toBeUndefined();
  });

  it('env vắng (dev local, CI) coi như ngoài production → đóng', () => {
    expect(robotsFor(undefined).rules).toEqual({ userAgent: '*', disallow: '/' });
  });
});
