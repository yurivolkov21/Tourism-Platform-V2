import { describe, expect, it } from 'vitest';
import { markdownH2s } from './markdown-headings.js';

describe('markdownH2s', () => {
  it('lấy H2 theo thứ tự kèm số dòng (đếm từ 1), nhãn và id là text thuần', () => {
    const md = '# Title\n\n## **Pack** light\n\nbody\n\n## Shoes that know mud\n';
    expect(markdownH2s(md)).toEqual([
      { line: 3, label: 'Pack light', id: 'pack-light' },
      { line: 7, label: 'Shoes that know mud', id: 'shoes-that-know-mud' },
    ]);
  });

  it('bỏ qua H3 và heading trong code fence', () => {
    const md = '### not me\n```\n## fenced\n```\n## real one\n';
    expect(markdownH2s(md)).toEqual([{ line: 5, label: 'real one', id: 'real-one' }]);
  });

  // L8-20: hai H2 cùng chữ từng ra cùng một id — HTML có id trùng, và mục thứ hai của
  // "On this page" nhảy về section đầu.
  it('heading trùng chữ: lần sau mang hậu tố -2, -3 theo thứ tự xuất hiện', () => {
    const md = '## Tips\n\n## Day one\n\n## Tips\n\n## Tips\n';
    expect(markdownH2s(md).map((h) => h.id)).toEqual(['tips', 'day-one', 'tips-2', 'tips-3']);
  });

  it('hậu tố không đè lên một heading thật đã mang đúng chữ ấy', () => {
    const md = '## Tips\n\n## Tips 2\n\n## Tips\n';
    expect(markdownH2s(md).map((h) => h.id)).toEqual(['tips', 'tips-2', 'tips-3']);
  });

  it('dòng CRLF vẫn ra nhãn sạch', () => {
    expect(markdownH2s('## Windows line\r\n\r\nbody\r\n')).toEqual([
      { line: 1, label: 'Windows line', id: 'windows-line' },
    ]);
  });
});
