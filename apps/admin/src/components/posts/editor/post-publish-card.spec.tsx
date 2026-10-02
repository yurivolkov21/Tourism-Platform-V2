import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PostReadinessItem } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { describe, expect, it, vi } from 'vitest';
import { PostPublishCard, type PostPublishCardProps } from './post-publish-card';

const t = messages.admin.posts.editor;
const p = t.publish;

function renderCard(patch: Partial<PostPublishCardProps> = {}) {
  const props: PostPublishCardProps = {
    status: 'PUBLISHED',
    publishAt: '2026-10-01T08:00',
    missing: [],
    publishAtError: undefined,
    pending: false,
    dirty: true,
    onStatusChange: vi.fn(),
    onPublishAtChange: vi.fn(),
    ...patch,
  };
  render(<PostPublishCard {...props} />);
  return props;
}

describe('PostPublishCard', () => {
  it('Draft: radio Draft chọn sẵn, câu nhắc nháp không lên web, không có ô ngày', () => {
    renderCard({ status: 'DRAFT', publishAt: '' });
    expect(screen.getByRole('radio', { name: p.draft })).toBeChecked();
    expect(screen.getByText(p.draftHint)).toBeInTheDocument();
    expect(screen.queryByLabelText(p.dateLabel)).not.toBeInTheDocument();
  });

  it('bấm Published báo lên đúng trạng thái đích', async () => {
    const user = userEvent.setup();
    const props = renderCard({ status: 'DRAFT', publishAt: '' });
    await user.click(screen.getByRole('radio', { name: p.published }));
    expect(props.onStatusChange).toHaveBeenCalledWith('PUBLISHED');
  });

  it('Published: ô ngày giờ UTC mang giá trị; đổi thì báo lên', () => {
    const props = renderCard();
    const date = screen.getByLabelText(p.dateLabel);
    expect(date).toHaveValue('2026-10-01T08:00');
    fireEvent.change(date, { target: { value: '2026-10-09T08:00' } });
    expect(props.onPublishAtChange).toHaveBeenCalledWith('2026-10-09T08:00');
  });

  it('danh sách kiểm tra: dòng thiếu ghi "Missing — required to publish", dòng đủ thì không', () => {
    const missing: PostReadinessItem[] = ['excerpt', 'cover'];
    renderCard({ missing });
    expect(screen.getAllByText(p.missing)).toHaveLength(2);
    expect(screen.getByText(p.readiness.content)).toBeInTheDocument();
  });

  it('Save khoá khi chưa có thay đổi; khoá kèm lý do khi đang tải ảnh bìa', () => {
    renderCard({ dirty: false });
    expect(screen.getByRole('button', { name: t.save })).toHaveAttribute('aria-disabled', 'true');
  });

  it('đang tải ảnh bìa: Save khoá và nói vì sao', () => {
    renderCard({ blockedNote: t.busyUploading });
    expect(screen.getByRole('button', { name: t.save })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByText(t.busyUploading)).toBeInTheDocument();
  });
});
