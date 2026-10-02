import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UnsavedChangesProvider } from '@/components/kit/unsaved-changes';
import type { LoadPhotoLibraryAction } from '@/lib/photo-library';
import type { SignCoverAction, UpdatePostAction } from '@/lib/posts-write';
import { POST_ID, POST_VERSION, postDetailFixture, TOUR_A, TOUR_B } from '@/test/post-detail';
import { PostEditor, type PostEditorProps } from './post-editor';

/**
 * Trang sửa bài (spec P4e-4 §4.4): MỘT form, MỘT nút Save gửi cả form; chặn đăng khi còn
 * thiếu TRƯỚC khi gửi; dải báo theo mã lỗi; phần đầu đọc bản đã lưu.
 */
const t = messages.admin.posts.editor;

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

afterEach(() => {
  vi.useRealTimers();
});

/** Props tối thiểu của task này; Task 10–12 thêm prop thì sửa ĐÚNG hàm này. */
function props(patch: Partial<PostEditorProps> = {}): PostEditorProps {
  return {
    detail: postDetailFixture(),
    update: vi.fn<UpdatePostAction>(),
    signCover: vi.fn<SignCoverAction>(),
    loadLibrary: vi.fn<LoadPhotoLibraryAction>(),
    tagOptions: [],
    tourOptions: [TOUR_A, TOUR_B],
    ...patch,
  };
}

function renderEditor(patch: Partial<PostEditorProps> = {}) {
  const user = userEvent.setup();
  const all = props(patch);
  render(<PostEditor {...all} />);
  return { user, ...all };
}

const saveButton = () => screen.getByRole('button', { name: t.save });

describe('PostEditor — lưu cả form', () => {
  it('chưa sửa gì thì Save khoá; sửa tiêu đề rồi lưu: gửi cả form, toast, refresh, Save khoá lại', async () => {
    const saved = postDetailFixture({
      title: 'Eating your way through Hội An, again',
      version: '2026-10-02T10:20:00.000Z',
    });
    const update = vi.fn<UpdatePostAction>().mockResolvedValue({ ok: true, detail: saved });
    const { user } = renderEditor({ update });
    expect(saveButton()).toHaveAttribute('aria-disabled', 'true');

    await user.type(screen.getByLabelText(t.fields.title), ', again');
    await user.click(saveButton());

    await waitFor(() => expect(success).toHaveBeenCalledWith(t.saved));
    expect(update).toHaveBeenCalledWith({
      id: POST_ID,
      version: POST_VERSION,
      title: 'Eating your way through Hội An, again',
      excerpt: 'Five stalls before noon.',
      content: '## Morning\n\nBánh mì first.',
      status: 'PUBLISHED',
      publishedAt: '2026-10-01T08:00:00.000Z',
      tags: ['Food'],
      relatedTourIds: [TOUR_A.id],
      cover: { publicId: `tourism/posts/${POST_ID}/cover`, alt: 'Lanterns over the river' },
    });
    expect(refresh).toHaveBeenCalled();
    expect(saveButton()).toHaveAttribute('aria-disabled', 'true');
    expect(
      screen.getByRole('heading', { level: 2, name: 'Eating your way through Hội An, again' }),
    ).toBeInTheDocument();
  });

  it('chọn Published khi còn thiếu: KHÔNG gửi lệnh; dải báo liệt kê mục thiếu, mỗi mục link tới ô', async () => {
    const update = vi.fn<UpdatePostAction>();
    const { user } = renderEditor({
      detail: postDetailFixture({ status: 'DRAFT', publishedAt: null, excerpt: null, cover: null }),
      update,
    });

    await user.click(screen.getByRole('radio', { name: t.publish.published }));
    await user.click(saveButton());

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(t.banners.notReady)).toBeInTheDocument();
    expect(within(alert).getByRole('link', { name: t.publish.readiness.excerpt })).toHaveAttribute(
      'href',
      '#post-excerpt',
    );
    expect(within(alert).getByRole('link', { name: t.publish.readiness.cover })).toHaveAttribute(
      'href',
      '#post-cover',
    );
    expect(
      within(alert).queryByRole('link', { name: t.publish.readiness.content }),
    ).not.toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
  });

  it('chuyển sang Published khi ô ngày trống: tự điền giờ hiện tại theo UTC', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-02T12:34:56.000Z'));
    const { user } = renderEditor({
      detail: postDetailFixture({ status: 'DRAFT', publishedAt: null }),
    });

    await user.click(screen.getByRole('radio', { name: t.publish.published }));

    expect(screen.getByLabelText(t.publish.dateLabel)).toHaveValue('2026-10-02T12:34');
  });

  it('STALE_POST: dải báo có Reload; bấm Reload làm mới trang', async () => {
    const update = vi.fn<UpdatePostAction>().mockResolvedValue({ ok: false, code: 'STALE_POST' });
    const { user } = renderEditor({ update });

    await user.type(screen.getByLabelText(t.fields.title), '!');
    await user.click(saveButton());

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(t.banners.stale)).toBeInTheDocument();
    await user.click(within(alert).getByRole('button', { name: t.banners.reload }));
    expect(refresh).toHaveBeenCalled();
  });

  it('NOT_FOUND: toast lỗi, về danh sách bài', async () => {
    const update = vi.fn<UpdatePostAction>().mockResolvedValue({ ok: false, code: 'NOT_FOUND' });
    const { user } = renderEditor({ update });

    await user.type(screen.getByLabelText(t.fields.title), '!');
    await user.click(saveButton());

    await waitFor(() => expect(push).toHaveBeenCalledWith('/posts'));
    expect(errorToast).toHaveBeenCalledWith(t.errors.NOT_FOUND);
  });

  it('lệnh ném: dải đỏ nói kết cục không rõ, kèm Reload', async () => {
    const update = vi.fn<UpdatePostAction>().mockRejectedValue(new Error('network'));
    const { user } = renderEditor({ update });

    await user.type(screen.getByLabelText(t.fields.title), '!');
    await user.click(saveButton());

    const alert = await screen.findByRole('alert');
    expect(within(alert).getByText(messages.admin.errors.write.GENERIC)).toBeInTheDocument();
    expect(within(alert).getByRole('button', { name: t.banners.reload })).toBeInTheDocument();
  });

  it('thân bài có ảnh nhúng: câu lỗi ngay dưới ô Content, lệnh không chạy', async () => {
    const update = vi.fn<UpdatePostAction>();
    const { user } = renderEditor({ update });
    const content = screen.getByLabelText(t.fields.content);

    await user.clear(content);
    await user.click(content);
    // `paste` chứ không `type`: user-event coi `[` là mở đầu tên phím.
    await user.paste('![x](https://example.com/x.jpg)');
    await user.click(saveButton());

    expect(await screen.findByText(t.form.errors.image)).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
  });

  it('rời trang khi còn thay đổi chưa lưu: hộp hỏi lại bật', async () => {
    const user = userEvent.setup();
    render(
      <UnsavedChangesProvider>
        <PostEditor {...props()} />
      </UnsavedChangesProvider>,
    );

    await user.type(screen.getByLabelText(t.fields.title), '!');
    await user.click(screen.getByRole('link', { name: t.back }));

    expect(
      await screen.findByRole('alertdialog', { name: messages.admin.unsavedChanges.title }),
    ).toBeInTheDocument();
  });

  it('PHOTO_NOT_ALLOWED: câu báo nằm ở card Cover, không ở dải đầu form', async () => {
    const update = vi
      .fn<UpdatePostAction>()
      .mockResolvedValue({ ok: false, code: 'PHOTO_NOT_ALLOWED' });
    const { user } = renderEditor({ update });

    await user.type(screen.getByLabelText(t.fields.title), '!');
    await user.click(saveButton());

    const cover = document.getElementById('post-cover') as HTMLElement;
    expect(await within(cover).findByText(t.errors.PHOTO_NOT_ALLOWED)).toBeInTheDocument();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  it('RELATED_TOUR_NOT_FOUND: câu báo nằm ở card Related tours', async () => {
    const update = vi
      .fn<UpdatePostAction>()
      .mockResolvedValue({ ok: false, code: 'RELATED_TOUR_NOT_FOUND' });
    const { user } = renderEditor({ update });

    await user.type(screen.getByLabelText(t.fields.title), '!');
    await user.click(saveButton());

    const card = screen.getByText(t.tours.title).closest('[data-slot="card"]') as HTMLElement;
    expect(await within(card).findByText(t.errors.RELATED_TOUR_NOT_FOUND)).toBeInTheDocument();
  });

  it('thêm tag và tour rồi lưu: payload mang đúng thứ tự đã soạn', async () => {
    const update = vi
      .fn<UpdatePostAction>()
      .mockResolvedValue({ ok: true, detail: postDetailFixture() });
    const { user } = renderEditor({ update });

    await user.type(screen.getByLabelText(t.tags.inputLabel), 'Street food{Enter}');
    await user.type(screen.getByLabelText(t.tours.searchLabel), 'my son');
    await user.click(screen.getByRole('button', { name: t.tours.add(TOUR_B.title) }));
    await user.click(saveButton());

    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls[0]?.[0]).toMatchObject({
      tags: ['Food', 'Street food'],
      relatedTourIds: [TOUR_A.id, TOUR_B.id],
    });
  });
});
