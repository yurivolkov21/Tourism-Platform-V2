import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SITE_URL } from '@/lib/site';
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

  it('Preview vẽ bằng bộ render của web; id heading mang tiền tố riêng; hàng nút ẩn đi', async () => {
    const user = userEvent.setup();
    render(<Harness initial={'## Post cover\n\nBánh mì first.'} />);

    await user.click(screen.getByRole('tab', { name: t.preview }));

    // Không tiền tố thì heading "Post cover" mang id `post-cover` — trùng id card ảnh bìa mà
    // link "A cover photo" của dải báo trỏ tới (vòng review P4e-4).
    expect(await screen.findByRole('heading', { level: 2, name: 'Post cover' })).toHaveAttribute(
      'id',
      'preview-post-cover',
    );
    expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
  });

  it('Preview: link tương đối trỏ về site khách và mở tab mới — bấm không rời trang sửa', async () => {
    const user = userEvent.setup();
    render(<Harness initial="See [Hoi An tours](/tours?destination=hoi-an)." />);

    await user.click(screen.getByRole('tab', { name: t.preview }));

    const link = await screen.findByRole('link', { name: 'Hoi An tours' });
    expect(link).toHaveAttribute('href', `${SITE_URL}/tours?destination=hoi-an`);
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('Preview vẫn giữ ô chữ trong trang — nhãn và link "Content" không trỏ vào khoảng không', async () => {
    const user = userEvent.setup();
    render(<Harness initial="Text" />);

    await user.click(screen.getByRole('tab', { name: t.preview }));

    expect(document.getElementById('post-content')).toBeInstanceOf(HTMLTextAreaElement);
  });

  it('đang ở Preview mà theo link #post-content (dải báo): quay về Write', async () => {
    const user = userEvent.setup();
    render(<Harness initial="Text" />);
    await user.click(screen.getByRole('tab', { name: t.preview }));

    window.location.hash = '#post-content';
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    expect(await screen.findByRole('toolbar')).toBeInTheDocument();
    window.location.hash = '';
  });

  it('Preview khi thân bài còn trống', async () => {
    const user = userEvent.setup();
    render(<Harness initial="   " />);

    await user.click(screen.getByRole('tab', { name: t.preview }));

    expect(await screen.findByText(t.previewEmpty)).toBeInTheDocument();
  });
});

describe('MarkdownEditor — lịch sử undo (vòng review P4e-4)', () => {
  afterEach(() => {
    Reflect.deleteProperty(document, 'execCommand');
  });

  it('trình duyệt có execCommand: chỉ chèn đúng đoạn đổi qua insertText — Ctrl+Z còn dùng được', async () => {
    const execCommand = vi.fn(() => true);
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true });
    const user = userEvent.setup();
    render(<Harness initial="eat pho now" />);

    select(4, 7);
    await user.click(screen.getByRole('button', { name: t.bold }));

    await waitFor(() => expect(execCommand).toHaveBeenCalledWith('insertText', false, '**pho**'));
  });
});
