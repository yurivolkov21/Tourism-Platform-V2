import { describe, expect, it } from 'vitest';
import { applyMarkdownAction, replacedRange } from './markdown-actions';

describe('applyMarkdownAction — Bold, Italic', () => {
  it('bọc vùng chọn và giữ chọn đúng chữ cũ', () => {
    expect(applyMarkdownAction('eat pho now', { start: 4, end: 7 }, 'bold')).toEqual({
      text: 'eat **pho** now',
      selection: { start: 6, end: 9 },
    });
  });

  it('không chọn gì: chèn cặp dấu, con trỏ ở giữa', () => {
    expect(applyMarkdownAction('ab', { start: 1, end: 1 }, 'italic')).toEqual({
      text: 'a**b',
      selection: { start: 2, end: 2 },
    });
  });

  it('vùng chọn ngược chiều (kéo từ phải sang trái) vẫn bọc đúng', () => {
    expect(applyMarkdownAction('eat pho now', { start: 7, end: 4 }, 'italic')).toEqual({
      text: 'eat *pho* now',
      selection: { start: 5, end: 8 },
    });
  });

  // Vòng review P4e-4: `**pho **` không phải chữ đậm trong CommonMark — trang công khai in
  // nguyên dấu sao. Double-click trên Windows chọn kèm dấu cách phía sau.
  it('khoảng trắng ở mép đứng ngoài cặp dấu', () => {
    expect(applyMarkdownAction('pho bo', { start: 0, end: 4 }, 'bold')).toEqual({
      text: '**pho** bo',
      selection: { start: 2, end: 5 },
    });
    expect(applyMarkdownAction('a  pho  b', { start: 1, end: 8 }, 'italic')).toEqual({
      text: 'a  *pho*  b',
      selection: { start: 4, end: 7 },
    });
  });

  it('chọn toàn khoảng trắng: như không chọn gì, cặp dấu đứng sau khoảng trắng', () => {
    expect(applyMarkdownAction('a   b', { start: 1, end: 4 }, 'bold')).toEqual({
      text: 'a   ****b',
      selection: { start: 6, end: 6 },
    });
  });
});

describe('applyMarkdownAction — Heading, Bullet list', () => {
  it('thêm `## ` cho dòng chứa con trỏ; vùng chọn mới phủ trọn dòng', () => {
    expect(applyMarkdownAction('intro\nMorning\nend', { start: 9, end: 9 }, 'heading')).toEqual({
      text: 'intro\n## Morning\nend',
      selection: { start: 6, end: 16 },
    });
  });

  it('bấm lại thì gỡ', () => {
    expect(applyMarkdownAction('## Morning', { start: 4, end: 4 }, 'heading')).toEqual({
      text: 'Morning',
      selection: { start: 0, end: 7 },
    });
  });

  it('nhiều dòng: thêm cho mỗi dòng có chữ, bỏ qua dòng trống', () => {
    expect(applyMarkdownAction('rice\n\nnoodles', { start: 0, end: 13 }, 'bullet')).toEqual({
      text: '- rice\n\n- noodles',
      selection: { start: 0, end: 17 },
    });
  });

  it('mọi dòng đã có tiền tố thì gỡ hết; chỉ một phần có thì thêm cho phần còn thiếu', () => {
    expect(applyMarkdownAction('- a\n- b', { start: 0, end: 7 }, 'bullet').text).toBe('a\nb');
    expect(applyMarkdownAction('- a\nb', { start: 0, end: 5 }, 'bullet').text).toBe('- a\n- b');
  });

  it('chọn trọn dòng kèm ký tự xuống dòng: dòng sau không bị tính', () => {
    expect(applyMarkdownAction('a\nb', { start: 0, end: 2 }, 'heading').text).toBe('## a\nb');
  });

  it('con trỏ trên dòng trống: vẫn thêm cho dòng ấy — bắt đầu một tiêu đề mới', () => {
    expect(applyMarkdownAction('a\n\nb', { start: 2, end: 2 }, 'heading')).toEqual({
      text: 'a\n## \nb',
      selection: { start: 2, end: 5 },
    });
  });

  it('con trỏ ở đầu văn bản mở đầu bằng dòng trống', () => {
    expect(applyMarkdownAction('\nb', { start: 0, end: 0 }, 'bullet').text).toBe('- \nb');
  });
});

describe('applyMarkdownAction — Link', () => {
  it('bọc vùng chọn thành [chữ](https://) và chọn sẵn phần URL để gõ đè', () => {
    expect(applyMarkdownAction('see the map', { start: 4, end: 11 }, 'link')).toEqual({
      text: 'see [the map](https://)',
      selection: { start: 14, end: 22 },
    });
  });

  it('không chọn gì: chèn [](https://), con trỏ vào trong ngoặc vuông để gõ chữ trước', () => {
    expect(applyMarkdownAction('see ', { start: 4, end: 4 }, 'link')).toEqual({
      text: 'see [](https://)',
      selection: { start: 5, end: 5 },
    });
  });
});

// Vòng review P4e-4: hàng nút thay CẢ giá trị ô nên mất Ctrl+Z — giờ chỉ thay đúng đoạn khác
// nhau qua `execCommand('insertText')`, và đây là hàm tìm đoạn ấy.
describe('replacedRange', () => {
  it('chỉ phần khác nhau giữa chữ cũ và chữ mới', () => {
    expect(replacedRange('eat pho now', 'eat **pho** now')).toEqual({
      start: 4,
      end: 7,
      insert: '**pho**',
    });
  });

  it('gỡ tiền tố: phần chèn rỗng', () => {
    expect(replacedRange('## Morning', 'Morning')).toEqual({ start: 0, end: 3, insert: '' });
  });

  it('ký tự lặp ở mép: phần đuôi chung không ăn sang phần đầu chung', () => {
    expect(replacedRange('aa', 'aaa')).toEqual({ start: 2, end: 2, insert: 'a' });
  });
});
