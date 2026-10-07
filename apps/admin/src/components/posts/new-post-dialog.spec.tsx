import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreatePostAction } from '@/lib/posts-write';
import { requestCreate } from '@/lib/quick-create';
import { NewPostDialog } from './new-post-dialog';

/**
 * Hộp New post (spec P4e-4 §4.3): tiêu đề và slug; slug tự điền theo tiêu đề tới khi admin
 * chạm vào nó; bài sinh ra là nháp rồi mở thẳng trang sửa.
 */
const t = messages.admin.posts.create;
const fe = messages.admin.posts.editor.form.errors;

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

/** "Breakfast in Hội An" — chữ "ộ" dựng từ mã số để slug phải đi qua slugifyVietnamese thật. */
const TITLE = `Breakfast in H${String.fromCodePoint(0x1ed9)}i An`;

async function openDialog(create: CreatePostAction = vi.fn()) {
  const user = userEvent.setup();
  render(<NewPostDialog create={create} />);
  await user.click(screen.getByRole('button', { name: t.action }));
  const dialog = await screen.findByRole('dialog', { name: t.dialog.title });
  return { user, dialog };
}

describe('NewPostDialog', () => {
  it('slug chạy theo tiêu đề tới khi admin tự gõ vào ô slug', async () => {
    const { user, dialog } = await openDialog();
    const slug = within(dialog).getByLabelText(t.slug);

    await user.type(within(dialog).getByLabelText(t.title), TITLE);
    expect(slug).toHaveValue('breakfast-in-hoi-an');

    await user.clear(slug);
    await user.type(slug, 'hoi-an-breakfast');
    await user.type(within(dialog).getByLabelText(t.title), ' again');
    expect(slug).toHaveValue('hoi-an-breakfast');
  });

  it('tạo xong: gửi bản đã trim, toast, mở trang sửa của bài mới', async () => {
    const create = vi.fn<CreatePostAction>().mockResolvedValue({
      ok: true,
      created: { id: '7a1b2c3d-0000-4000-8000-0000000000aa', slug: 'breakfast-in-hoi-an' },
    });
    const { user, dialog } = await openDialog(create);

    await user.type(within(dialog).getByLabelText(t.title), `  ${TITLE}  `);
    await user.click(within(dialog).getByRole('button', { name: t.dialog.submit }));

    await waitFor(() => expect(push).toHaveBeenCalledWith('/posts/breakfast-in-hoi-an'));
    expect(create).toHaveBeenCalledWith({ title: TITLE, slug: 'breakfast-in-hoi-an' });
    expect(success).toHaveBeenCalledWith(t.toast.title, { description: t.toast.body });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('SLUG_TAKEN báo ngay dưới ô slug; hộp vẫn mở, chữ còn nguyên', async () => {
    const create = vi.fn<CreatePostAction>().mockResolvedValue({ ok: false, code: 'SLUG_TAKEN' });
    const { user, dialog } = await openDialog(create);

    await user.type(within(dialog).getByLabelText(t.title), 'Breakfast');
    await user.click(within(dialog).getByRole('button', { name: t.dialog.submit }));

    expect(await within(dialog).findByText(t.errors.SLUG_TAKEN)).toBeInTheDocument();
    expect(within(dialog).getByLabelText(t.slug)).toHaveValue('breakfast');
    expect(within(dialog).getByLabelText(t.slug)).toHaveAccessibleDescription(
      `${t.slugHint} ${t.errors.SLUG_TAKEN}`,
    );
    expect(push).not.toHaveBeenCalled();
  });

  it('bấm tạo khi trống: hai ô báo "Fill this in", lệnh không chạy', async () => {
    const create = vi.fn<CreatePostAction>();
    const { user, dialog } = await openDialog(create);

    await user.click(within(dialog).getByRole('button', { name: t.dialog.submit }));

    expect(within(dialog).getAllByText(fe.required)).toHaveLength(2);
    expect(create).not.toHaveBeenCalled();
  });

  it('lệnh ném (kết cục không rõ): đóng hộp, toast lỗi chung, làm mới bảng', async () => {
    const create = vi.fn<CreatePostAction>().mockRejectedValue(new Error('network'));
    const { user, dialog } = await openDialog(create);

    await user.type(within(dialog).getByLabelText(t.title), 'Breakfast');
    await user.click(within(dialog).getByRole('button', { name: t.dialog.submit }));

    await waitFor(() =>
      expect(errorToast).toHaveBeenCalledWith(messages.admin.errors.write.GENERIC),
    );
    expect(refresh).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it('Quick Create từ trang khác: yêu cầu đang chờ lúc mount → hộp mở sẵn mà không cần bấm nút', async () => {
    requestCreate('post');
    render(<NewPostDialog create={vi.fn()} />);
    expect(await screen.findByRole('dialog', { name: t.dialog.title })).toBeInTheDocument();
  });

  it('Quick Create ngay trên trang này: yêu cầu mới mở hộp ngay, không cần bấm nút', async () => {
    render(<NewPostDialog create={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();

    act(() => requestCreate('post'));
    expect(await screen.findByRole('dialog', { name: t.dialog.title })).toBeInTheDocument();
  });

  it('hộp mở bằng Quick Create, không qua nút: Esc thì focus về nút New post, không rơi về body (review A2-8)', async () => {
    const user = userEvent.setup();
    requestCreate('post');
    render(<NewPostDialog create={vi.fn()} />);
    await screen.findByRole('dialog', { name: t.dialog.title });

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(screen.getByRole('button', { name: t.action })).toHaveFocus());
  });
});
