import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DeletePostAction } from '@/lib/posts-write';
import { POST_ID, postDetailFixture } from '@/test/post-detail';
import { DeletePostZone } from './delete-post-zone';

/** Vùng xoá bài (spec P4e-4 §2.7, §4.6): hộp xác nhận nói đúng hệ quả, mang phiên bản form. */
const d = messages.admin.posts.delete;

const success = vi.fn();
const errorToast = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => success(...args),
    error: (...args: unknown[]) => errorToast(...args),
  },
}));

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: (href: string) => push(href), refresh: () => refresh() }),
}));

beforeEach(() => {
  success.mockReset();
  errorToast.mockReset();
  push.mockReset();
  refresh.mockReset();
});

/** Phiên bản form đang cầm — KHÁC `version` của fixture, để bắt vùng xoá đọc nhầm nguồn. */
const FORM_VERSION = '2026-10-02T10:20:00.000Z';

async function openDialog(remove: DeletePostAction) {
  const user = userEvent.setup();
  render(<DeletePostZone detail={postDetailFixture()} version={FORM_VERSION} remove={remove} />);
  await user.click(screen.getByRole('button', { name: d.action }));
  const dialog = await screen.findByRole('dialog', { name: d.dialog.title });
  return { user, dialog };
}

describe('DeletePostZone', () => {
  it('hộp nói đúng hệ quả; xoá xong: gửi id và phiên bản form đang cầm, toast, về /posts', async () => {
    const remove = vi
      .fn<DeletePostAction>()
      .mockResolvedValue({ ok: true, deleted: { slug: 'eating-your-way-through-hoi-an' } });
    const { user, dialog } = await openDialog(remove);

    expect(within(dialog).getByText(d.dialog.body)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: d.dialog.submit }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/posts'));
    expect(remove).toHaveBeenCalledWith({ id: POST_ID, version: FORM_VERSION });
    expect(success).toHaveBeenCalledWith(d.toast.title, {
      description: d.toast.body('Eating your way through Hội An'),
    });
  });

  it('STALE_POST: đóng hộp, toast, ở lại trang và làm mới', async () => {
    const remove = vi.fn<DeletePostAction>().mockResolvedValue({ ok: false, code: 'STALE_POST' });
    const { user, dialog } = await openDialog(remove);

    await user.click(within(dialog).getByRole('button', { name: d.dialog.submit }));

    await waitFor(() => expect(errorToast).toHaveBeenCalledWith(d.errors.STALE_POST));
    expect(refresh).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('NOT_FOUND (người khác đã xoá trước): đóng hộp, toast, về /posts', async () => {
    const remove = vi.fn<DeletePostAction>().mockResolvedValue({ ok: false, code: 'NOT_FOUND' });
    const { user, dialog } = await openDialog(remove);

    await user.click(within(dialog).getByRole('button', { name: d.dialog.submit }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/posts'));
    expect(errorToast).toHaveBeenCalledWith(d.errors.NOT_FOUND);
  });

  // Vòng review P4e-4: không rõ lệnh đã đi tới đâu mà làm mới trang này thì 404 nếu bài thật ra
  // đã bị xoá — danh sách mới là nơi cho biết bài còn hay mất.
  it('kết cục không rõ (GENERIC): đóng hộp, toast, về /posts thay vì làm mới', async () => {
    const remove = vi.fn<DeletePostAction>().mockResolvedValue({ ok: false, code: 'GENERIC' });
    const { user, dialog } = await openDialog(remove);

    await user.click(within(dialog).getByRole('button', { name: d.dialog.submit }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/posts'));
    expect(refresh).not.toHaveBeenCalled();
  });

  it('Cancel: không gửi lệnh', async () => {
    const remove = vi.fn<DeletePostAction>();
    const { user, dialog } = await openDialog(remove);

    await user.click(within(dialog).getByRole('button', { name: d.dialog.cancel }));

    expect(remove).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
