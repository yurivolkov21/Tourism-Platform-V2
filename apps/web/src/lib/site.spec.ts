import { describe, expect, it } from 'vitest';
import { absoluteUrl, escapeXml } from './site.js';

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

describe('escapeXml', () => {
  it('thoát 5 ký tự XML nguy hiểm', () => {
    expect(escapeXml(`<a href="x">Bún & phở 'ngon'</a>`)).toBe(
      '&lt;a href=&quot;x&quot;&gt;Bún &amp; phở &apos;ngon&apos;&lt;/a&gt;',
    );
  });

  it('thoát & TRƯỚC rồi mới tới các ký tự khác — không nhân đôi escape', () => {
    expect(escapeXml('&lt;')).toBe('&amp;lt;');
  });

  it('chuỗi không có ký tự đặc biệt thì giữ nguyên', () => {
    expect(escapeXml('Hoi An at night')).toBe('Hoi An at night');
  });
});
