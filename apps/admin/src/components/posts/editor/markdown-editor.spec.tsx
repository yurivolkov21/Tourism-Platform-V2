import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { MarkdownEditor } from './markdown-editor';

/**
 * Trình soạn thân bài (spec P4e-4 §4.4): hàng nút chèn cú pháp và giữ tiêu điểm ở ô; tab
 * Preview vẽ bằng CHÍNH bộ render của web.
 */
const t = messages.admin.posts.editor.markdown;

function Harness({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <MarkdownEditor
      id="post-content"
      value={value}
      onChange={setValue}
      invalid={false}
      describedBy={undefined}
    />
  );
}

function textarea(): HTMLTextAreaElement {
  const node = screen.getByRole('textbox');
  if (!(node instanceof HTMLTextAreaElement)) throw new Error('Không thấy ô chữ');
  return node;
}

function select(start: number, end: number) {
  textarea().focus();
  textarea().setSelectionRange(start, end);
}

describe('MarkdownEditor', () => {
  it('Bold bọc vùng chọn, giữ tiêu điểm ở ô và chọn lại đúng chữ cũ', async () => {
    const user = userEvent.setup();
    render(<Harness initial="eat pho now" />);
    select(4, 7);

    await user.click(screen.getByRole('button', { name: t.bold }));

    expect(textarea()).toHaveValue('eat **pho** now');
    expect(textarea()).toHaveFocus();
    expect([textarea().selectionStart, textarea().selectionEnd]).toEqual([6, 9]);
  });

  it('Heading thêm `## ` cho dòng chứa con trỏ; bấm lần nữa thì gỡ', async () => {
    const user = userEvent.setup();
    render(<Harness initial={'intro\nMorning'} />);
    select(9, 9);

    await user.click(screen.getByRole('button', { name: t.heading }));
    expect(textarea()).toHaveValue('intro\n## Morning');

    await user.click(screen.getByRole('button', { name: t.heading }));
    expect(textarea()).toHaveValue('intro\nMorning');
  });

  it('Link bọc vùng chọn và chọn sẵn đúng phần URL để gõ đè', async () => {
    const user = userEvent.setup();
    render(<Harness initial="see the map" />);
    select(4, 11);

    await user.click(screen.getByRole('button', { name: t.link }));

    expect(textarea()).toHaveValue('see [the map](https://)');
    expect(textarea()).toHaveFocus();
    expect(textarea().value.slice(textarea().selectionStart, textarea().selectionEnd)).toBe(
      'https://',
    );
  });

  it('hàng nút là một toolbar có tên, trỏ tới ô chữ', () => {
    render(<Harness initial="" />);
    expect(screen.getByRole('toolbar', { name: t.toolbar })).toHaveAttribute(
      'aria-controls',
      'post-content',
    );
  });

  it('Preview vẽ bằng bộ render của web (id heading như trang bài); hàng nút ẩn đi', async () => {
    const user = userEvent.setup();
    render(<Harness initial={'## Morning\n\nBánh mì first.'} />);

    await user.click(screen.getByRole('tab', { name: t.preview }));

    expect(await screen.findByRole('heading', { level: 2, name: 'Morning' })).toHaveAttribute(
      'id',
      'morning',
    );
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  });

  it('Preview khi thân bài còn trống', async () => {
    const user = userEvent.setup();
    render(<Harness initial="   " />);

    await user.click(screen.getByRole('tab', { name: t.preview }));

    expect(await screen.findByText(t.previewEmpty)).toBeInTheDocument();
  });
});
