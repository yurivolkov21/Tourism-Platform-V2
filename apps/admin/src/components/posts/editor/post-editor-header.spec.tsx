import { render, screen } from '@testing-library/react';
import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import { postDetailFixture } from '@/test/post-detail';
import { PostEditorHeader } from './post-editor-header';

const t = messages.admin.posts.editor;

describe('PostEditorHeader', () => {
  it('bài đã đăng: chip Published, View on site mở trang bài ở tab mới, Last saved theo UTC', () => {
    render(<PostEditorHeader detail={postDetailFixture()} />);

    expect(screen.getByText(messages.admin.posts.status.published)).toBeInTheDocument();
    const view = screen.getByRole('link', { name: t.viewOnSite });
    expect(view).toHaveAttribute(
      'href',
      'https://www.nexora-travel.agency/blog/eating-your-way-through-hoi-an',
    );
    expect(view).toHaveAttribute('target', '_blank');
    expect(
      screen.getByText(t.lastSaved('2 Oct 2026, 10:11 UTC'), { exact: false }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.back })).toHaveAttribute('href', '/posts');
  });

  it('bài hẹn giờ: chip Scheduled, không có View on site (trang bài còn 404)', () => {
    render(
      <PostEditorHeader detail={postDetailFixture({ publishedAt: '2026-10-09T08:00:00.000Z' })} />,
    );

    expect(screen.getByText(messages.admin.posts.status.scheduled)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: t.viewOnSite })).not.toBeInTheDocument();
  });
});
