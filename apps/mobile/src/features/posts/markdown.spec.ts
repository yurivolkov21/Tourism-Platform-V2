import { parseMarkdown } from './markdown';

describe('parseMarkdown', () => {
  it('## thành heading, đoạn văn liền dòng gộp một khối', () => {
    expect(parseMarkdown('## Layers beat one big coat\nSa Pa runs cold at 6am.')).toEqual([
      { type: 'heading', text: 'Layers beat one big coat' },
      { type: 'paragraph', text: 'Sa Pa runs cold at 6am.' },
    ]);
  });

  it('nhiều dòng liền của một đoạn văn (không dòng trống) gộp lại MỘT paragraph', () => {
    expect(parseMarkdown('Dòng một.\nDòng hai.')).toEqual([
      { type: 'paragraph', text: 'Dòng một. Dòng hai.' },
    ]);
  });

  it('dòng trống ngăn hai đoạn văn thành hai khối riêng', () => {
    expect(parseMarkdown('Đoạn một.\n\nĐoạn hai.')).toEqual([
      { type: 'paragraph', text: 'Đoạn một.' },
      { type: 'paragraph', text: 'Đoạn hai.' },
    ]);
  });

  it('- thành list, các dòng - liền kề gộp MỘT khối list', () => {
    expect(parseMarkdown('- Item one\n- Item two\n- Item three')).toEqual([
      { type: 'list', items: ['Item one', 'Item two', 'Item three'] },
    ]);
  });

  it('heading → đoạn văn → list → đoạn văn, đúng thứ tự bốn khối', () => {
    expect(parseMarkdown('## Title\nIntro.\n- A\n- B\nOutro.')).toEqual([
      { type: 'heading', text: 'Title' },
      { type: 'paragraph', text: 'Intro.' },
      { type: 'list', items: ['A', 'B'] },
      { type: 'paragraph', text: 'Outro.' },
    ]);
  });

  it('cú pháp lạ (in đậm) rơi về đoạn-văn-thường, KHÔNG in ký hiệu thô', () => {
    expect(parseMarkdown('This is **bold** and _italic_ and [a link](https://x.test).')).toEqual([
      { type: 'paragraph', text: 'This is bold and italic and a link.' },
    ]);
  });

  it('chuỗi rỗng hoặc chỉ dòng trống → mảng rỗng', () => {
    expect(parseMarkdown('')).toEqual([]);
    expect(parseMarkdown('\n\n\n')).toEqual([]);
  });
});
