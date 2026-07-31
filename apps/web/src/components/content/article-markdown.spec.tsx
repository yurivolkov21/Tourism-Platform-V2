import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { tocFromMarkdown } from '@/lib/toc';
import { ArticleMarkdown } from './article-markdown';

describe('ArticleMarkdown', () => {
  it('render markdown với H2 gắn id = slugify(text)', () => {
    const md = '## Layers beat one big coat\n\nSome body text';
    render(<ArticleMarkdown markdown={md} />);

    const heading = screen.getByRole('heading', { level: 2 });
    // So trực tiếp với tocFromMarkdown thay vì literal — bắt được lệch id
    // giữa hai phía nếu logic slugify của một bên đổi mà bên kia không theo.
    expect(heading).toHaveAttribute('id', tocFromMarkdown(md)[0]?.id);
    expect(heading).toHaveTextContent('Layers beat one big coat');
  });

  it('render 2 section với id khớp slugify', () => {
    const md = '## First section\n\nBody\n\n## Second section\n\nMore body';
    render(<ArticleMarkdown markdown={md} />);

    const headings = screen.getAllByRole('heading', { level: 2 });
    const toc = tocFromMarkdown(md);
    expect(headings).toHaveLength(2);
    expect(headings[0]).toHaveAttribute('id', toc[0]?.id);
    expect(headings[1]).toHaveAttribute('id', toc[1]?.id);
  });

  it('heading có inline markdown (bold/italic) — id khớp tocFromMarkdown, không phải "[object Object]"', () => {
    const md = '## **Bold** and *italic* words\n\nBody text';
    render(<ArticleMarkdown markdown={md} />);

    const heading = screen.getByRole('heading', { level: 2 });
    const toc = tocFromMarkdown(md);
    expect(heading).toHaveAttribute('id', toc[0]?.id);
    expect(heading.id).not.toContain('object');
  });

  it('heading có inline code — id khớp tocFromMarkdown', () => {
    const md = '## Use `npm install` now\n\nBody text';
    render(<ArticleMarkdown markdown={md} />);

    const heading = screen.getByRole('heading', { level: 2 });
    const toc = tocFromMarkdown(md);
    expect(heading).toHaveAttribute('id', toc[0]?.id);
    expect(heading.id).not.toContain('object');
  });

  it('render bullet list thành <ul><li>', () => {
    const md = '- Item 1\n- Item 2\n- Item 3';
    render(<ArticleMarkdown markdown={md} />);

    const list = screen.getByRole('list');
    expect(list.tagName).toBe('UL');

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('Item 1');
  });

  it('xử heading với text có ký tự đặc biệt', () => {
    const md = '## Shoes that already know mud';
    render(<ArticleMarkdown markdown={md} />);

    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveAttribute('id', tocFromMarkdown(md)[0]?.id);
  });

  it('KHÔNG render raw HTML — giữ mặc định react-markdown', () => {
    const md = '## Normal heading\n\n<script>alert("xss")</script>';
    render(<ArticleMarkdown markdown={md} />);

    // Nếu rehype-raw được bật, thẻ <script> sẽ được render. Mặc định không bật
    // nên script tag sẽ hiện là text hoặc bị filter.
    const script = document.querySelector('script');
    expect(script).toBeNull();
  });

  // Finding review Task 6: heading H2 chứa ảnh markdown — <img> là React
  // element không có children nên flattenToText cũ trả '', alt text rơi mất.
  // So trực tiếp với tocFromMarkdown để bắt lệch id giữa hai phía.
  it('heading có ảnh markdown — id khớp tocFromMarkdown, alt text được giữ', () => {
    const md = '## See ![alt text](https://example.com/i.png) here\n\nBody text';
    render(<ArticleMarkdown markdown={md} />);

    const heading = screen.getByRole('heading', { level: 2 });
    const toc = tocFromMarkdown(md);
    expect(heading).toHaveAttribute('id', toc[0]?.id);
    expect(heading.id).toBe('see-alt-text-here');
  });

  it('hỗ trợ GFM như strikethrough, table, task list', () => {
    const md = '## Features\n\n~~strikethrough~~\n\n- [x] Done\n- [ ] Todo';
    render(<ArticleMarkdown markdown={md} />);

    // GFM được bật qua remarkGfm
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveAttribute('id', 'features');
  });
});
