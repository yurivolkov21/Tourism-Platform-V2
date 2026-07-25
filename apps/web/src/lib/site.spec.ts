import { afterEach, describe, expect, it, vi } from 'vitest';
import { absoluteUrl, escapeXml, siteUrl } from './site.js';

// Trả env về nguyên trạng sau mỗi test — siteUrl() đọc process.env lúc GỌI
// (không phải lúc nạp module) nên stub được, nhưng phải dọn kẻo rò sang test khác.
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('absoluteUrl', () => {
  it('ghép đường dẫn tuyệt đối lên gốc site', () => {
    expect(absoluteUrl('/blog')).toMatch(/^https?:\/\/[^/]+\/blog$/);
  });

  it('không sinh dấu gạch đôi khi đường dẫn đã có / đầu', () => {
    expect(absoluteUrl('/blog')).not.toMatch(/[^:]\/\//);
  });

  it('nhận cả đường dẫn không có / đầu', () => {
    expect(absoluteUrl('blog')).toBe(absoluteUrl('/blog'));
  });
});

describe('siteUrl', () => {
  it('cắt dấu / thừa ở cuối biến env — nếu không sẽ sinh URL có //', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.com///');
    expect(siteUrl()).toBe('https://example.com');
    expect(absoluteUrl('/blog')).toBe('https://example.com/blog');
  });

  it('biến env rỗng thì rơi về fallback localhost', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '   ');
    expect(siteUrl()).toBe('http://localhost:3000');
  });
});

describe('escapeXml', () => {
  it('thoát 5 ký tự XML nguy hiểm', () => {
    expect(escapeXml(`<a href="x">Bún & phở 'ngon'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Bún &amp; phở &apos;ngon&apos;&lt;/a&gt;',
    );
  });

  it('thoát & TRƯỚC rồi mới tới ký tự khác — không escape chồng', () => {
    // Input có ký tự `<` THẬT: nếu escape `&` sau cùng thì `&lt;` do bước
    // trước sinh ra sẽ bị escape lần nữa thành `&amp;lt;`.
    expect(escapeXml('a < b & c')).toBe('a &lt; b &amp; c');
  });

  it('chuỗi không có ký tự đặc biệt thì giữ nguyên', () => {
    expect(escapeXml('Hoi An at night')).toBe('Hoi An at night');
  });
});
