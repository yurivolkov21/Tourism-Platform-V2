import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminPhotoLibrary, SignedUploadParams } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { useState } from 'react';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import type { LoadPhotoLibraryAction } from '@/lib/photo-library';
import { uploadPhoto } from '@/lib/photo-upload';
import type { PostCoverDraft } from '@/lib/post-form';
import type { SignCoverAction } from '@/lib/posts-write';
import { POST_ID } from '@/test/post-detail';
import { PostCoverCard } from './post-cover-card';

/**
 * Card Cover (spec P4e-4 §4.4): tải lên hoặc chọn từ thư viện, alt tuỳ chọn, ảnh catalog
 * nói không chọn lại được, đang tải thì báo "bận" lên trang để Save khoá.
 */
// Giữ phần thuần thật (đuôi file…), chỉ thay đường XHR — khuôn spec tab Photos.
vi.mock('@/lib/photo-upload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/photo-upload')>()),
  uploadPhoto: vi.fn(),
}));
const uploadMock = uploadPhoto as unknown as Mock;

const c = messages.admin.posts.editor.cover;

const PARAMS: SignedUploadParams = {
  signature: 'sig',
  timestamp: 1_760_000_000,
  apiKey: 'key',
  cloudName: 'demo',
  folder: `tourism/posts/${POST_ID}`,
  publicId: 'pid-1',
  allowedFormats: 'jpg,jpeg,png,webp,avif,gif',
  transformation: 'c_limit,w_2400,h_2400,fl_force_strip',
  overwrite: false,
  uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
};
const UPLOADED = {
  publicId: `tourism/posts/${POST_ID}/pid-1`,
  upload: { version: '1759000000', width: 2000, height: 1333, format: 'jpg', bytes: 1000 },
};
const CURRENT: PostCoverDraft = {
  publicId: `tourism/posts/${POST_ID}/cover`,
  url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1/tourism/posts/x/cover',
  alt: 'Lanterns',
  source: 'UPLOAD',
};
const LIBRARY: AdminPhotoLibrary = [
  {
    destination: { id: '7a1b2c3d-0000-4000-8000-0000000000d1', name: 'Hội An' },
    photos: [
      {
        publicId: 'lib/a1',
        url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/lib/a1',
        alt: 'Old town at dusk',
        width: 2400,
        height: 1600,
        author: null,
        license: null,
      },
    ],
  },
];

beforeEach(() => {
  uploadMock.mockReset();
});

const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;
const file = (name: string, bytes = 10) =>
  new File([new Uint8Array(bytes)], name, { type: 'image/jpeg' });

/** Giữ ảnh bìa trong state như trang sửa — card chỉ báo lên, không tự giữ. */
function Harness({
  initial,
  sign = vi.fn<SignCoverAction>(),
  loadLibrary = vi.fn<LoadPhotoLibraryAction>(),
  onBusyChange = vi.fn(),
  serverError = null,
}: {
  initial: PostCoverDraft | null;
  sign?: SignCoverAction;
  loadLibrary?: LoadPhotoLibraryAction;
  onBusyChange?: (busy: boolean) => void;
  serverError?: string | null;
}) {
  const [cover, setCover] = useState<PostCoverDraft | null>(initial);
  return (
    <>
      <PostCoverCard
        postId={POST_ID}
        cover={cover}
        altError={undefined}
        serverError={serverError}
        onChange={setCover}
        onBusyChange={onBusyChange}
        sign={sign}
        loadLibrary={loadLibrary}
      />
      <output data-testid="cover">
        {cover === null
          ? 'none'
          : `${cover.publicId}|${cover.alt}|${cover.source}|${cover.upload ? 'meta' : 'no-meta'}`}
      </output>
    </>
  );
}

describe('PostCoverCard', () => {
  it('tải lên: ký đúng bài, báo bận trong lúc tải, ảnh mới thành ảnh bìa kèm metadata', async () => {
    let finish: (value: typeof UPLOADED) => void = () => {};
    uploadMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const sign = vi.fn<SignCoverAction>().mockResolvedValue({ ok: true, params: PARAMS });
    const onBusyChange = vi.fn();
    const user = userEvent.setup({ applyAccept: false });
    render(<Harness initial={null} sign={sign} onBusyChange={onBusyChange} />);

    await user.upload(fileInput(), file('lanterns.jpg'));

    await waitFor(() => expect(uploadMock).toHaveBeenCalled());
    expect(sign).toHaveBeenCalledWith({ id: POST_ID });
    expect(onBusyChange).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('button', { name: c.upload })).toHaveAttribute('aria-disabled', 'true');

    finish(UPLOADED);

    await waitFor(() =>
      expect(screen.getByTestId('cover')).toHaveTextContent(`${UPLOADED.publicId}||UPLOAD|meta`),
    );
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
  });

  it('file sai loại hay quá 10 MB: báo ngay, không ký', async () => {
    const sign = vi.fn<SignCoverAction>();
    const user = userEvent.setup({ applyAccept: false });
    render(<Harness initial={CURRENT} sign={sign} />);

    await user.upload(fileInput(), file('notes.pdf'));

    expect(await screen.findByText(c.skipped.type('notes.pdf'))).toBeInTheDocument();
    expect(sign).not.toHaveBeenCalled();
  });

  it('ký hỏng: câu theo mã, không tải, hết bận', async () => {
    const sign = vi
      .fn<SignCoverAction>()
      .mockResolvedValue({ ok: false, code: 'MEDIA_UPLOAD_NOT_CONFIGURED' });
    const onBusyChange = vi.fn();
    const user = userEvent.setup({ applyAccept: false });
    render(<Harness initial={null} sign={sign} onBusyChange={onBusyChange} />);

    await user.upload(fileInput(), file('lanterns.jpg'));

    expect(
      await screen.findByText(messages.admin.posts.editor.signErrors.MEDIA_UPLOAD_NOT_CONFIGURED),
    ).toBeInTheDocument();
    expect(uploadMock).not.toHaveBeenCalled();
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
  });

  it('tải hỏng: câu báo, ảnh bìa cũ giữ nguyên', async () => {
    uploadMock.mockRejectedValue(new Error('Cloudinary upload failed (500)'));
    const sign = vi.fn<SignCoverAction>().mockResolvedValue({ ok: true, params: PARAMS });
    const user = userEvent.setup({ applyAccept: false });
    render(<Harness initial={CURRENT} sign={sign} />);

    await user.upload(fileInput(), file('lanterns.jpg'));

    expect(await screen.findByText(c.uploadFailed)).toBeInTheDocument();
    expect(screen.getByTestId('cover')).toHaveTextContent(
      `${CURRENT.publicId}|Lanterns|UPLOAD|no-meta`,
    );
  });

  it('chọn từ thư viện: ảnh thay ảnh bìa, alt chép từ ảnh gốc, nguồn LIBRARY', async () => {
    const user = userEvent.setup();
    const loadLibrary = vi
      .fn<LoadPhotoLibraryAction>()
      .mockResolvedValue({ ok: true, library: LIBRARY });
    render(<Harness initial={CURRENT} loadLibrary={loadLibrary} />);

    await user.click(screen.getByRole('button', { name: c.library }));
    // Chọn một ảnh là THAY ảnh bìa — hộp nói đúng thế, không mượn giọng "Add photos" của tab
    // Photos (vòng review P4e-4).
    const dialog = await screen.findByRole('dialog', { name: c.libraryDialog.title });
    expect(within(dialog).getByText(c.libraryDialog.replaces)).toBeInTheDocument();
    await user.click(await within(dialog).findByRole('checkbox', { name: 'Old town at dusk' }));
    await user.click(within(dialog).getByRole('button', { name: c.libraryDialog.use }));

    expect(screen.getByTestId('cover')).toHaveTextContent(
      'lib/a1|Old town at dusk|LIBRARY|no-meta',
    );
  });

  it('chưa có ảnh bìa: hộp thư viện nói chọn một ảnh, không nói "thay"', async () => {
    const user = userEvent.setup();
    const loadLibrary = vi
      .fn<LoadPhotoLibraryAction>()
      .mockResolvedValue({ ok: true, library: LIBRARY });
    render(<Harness initial={null} loadLibrary={loadLibrary} />);

    await user.click(screen.getByRole('button', { name: c.library }));

    const dialog = await screen.findByRole('dialog', { name: c.libraryDialog.title });
    expect(within(dialog).getByText(c.libraryDialog.pickOne)).toBeInTheDocument();
  });

  // Vòng review P4e-4: ảnh thư viện vừa chọn có thể đã rời kho — kho tải từ trước vẫn bày nó.
  it('lần lưu bị từ chối ảnh bìa (PHOTO_NOT_ALLOWED): lần mở sau tải lại kho ảnh', async () => {
    const user = userEvent.setup();
    const loadLibrary = vi
      .fn<LoadPhotoLibraryAction>()
      .mockResolvedValue({ ok: true, library: LIBRARY });
    const { rerender } = render(<Harness initial={CURRENT} loadLibrary={loadLibrary} />);
    await user.click(screen.getByRole('button', { name: c.library }));
    const dialog = await screen.findByRole('dialog');
    await within(dialog).findByRole('checkbox', { name: 'Old town at dusk' });
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(loadLibrary).toHaveBeenCalledTimes(1);

    rerender(
      <Harness
        initial={CURRENT}
        loadLibrary={loadLibrary}
        serverError="This cover photo is no longer available."
      />,
    );
    await user.click(screen.getByRole('button', { name: c.library }));

    await waitFor(() => expect(loadLibrary).toHaveBeenCalledTimes(2));
  });

  // Vòng review P4e-4: bộ huỷ từng chỉ dựng SAU khi ký xong — rời trang lúc đang ký thì lượt
  // tải vẫn chạy tiếp, ảnh thành mồ côi trên Cloudinary.
  it('rời trang lúc đang ký: không tải lên nữa', async () => {
    let finishSign: (result: Awaited<ReturnType<SignCoverAction>>) => void = () => {};
    const sign = vi.fn<SignCoverAction>().mockReturnValue(
      new Promise((resolve) => {
        finishSign = resolve;
      }),
    );
    const user = userEvent.setup({ applyAccept: false });
    const { unmount } = render(<Harness initial={null} sign={sign} />);

    await user.upload(fileInput(), file('lanterns.jpg'));
    await waitFor(() => expect(sign).toHaveBeenCalled());
    unmount();
    finishSign({ ok: true, params: PARAMS });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('gỡ ảnh bìa: tiêu điểm về nút Upload, không rơi về body', async () => {
    const user = userEvent.setup();
    render(<Harness initial={CURRENT} />);

    await user.click(screen.getByRole('button', { name: c.remove }));

    expect(screen.getByTestId('cover')).toHaveTextContent('none');
    expect(screen.getByRole('button', { name: c.upload })).toHaveFocus();
  });

  it('ảnh bìa tải hỏng: khung 3:2 hiện ô có tên "Photo unavailable", vẫn gỡ được (review AL4)', () => {
    render(<Harness initial={CURRENT} />);
    const figure = screen.getByRole('figure');

    fireEvent.error(figure.querySelector('img') as HTMLImageElement);

    expect(
      within(figure).getByRole('img', { name: messages.admin.table.photoUnavailable }),
    ).toHaveClass('aspect-[3/2]', 'w-full');
    expect(screen.getByRole('button', { name: c.remove })).toBeInTheDocument();
  });

  it('ảnh catalog: nói ngay trên ảnh rằng gỡ ra là không chọn lại được', () => {
    render(<Harness initial={{ ...CURRENT, source: 'CATALOG' }} />);
    // Khớp TRỌN chuỗi ghép — `exact: false` là khớp chuỗi con không phân biệt hoa thường, nên
    // mất nhãn "Catalogue photo" vẫn xanh (vòng review P4e-4).
    expect(screen.getByText(`${c.source.CATALOG} · ${c.catalogueWarning}`)).toBeInTheDocument();
  });

  it('alt sửa được; lỗi lần lưu trước (PHOTO_NOT_ALLOWED) hiện tại card', async () => {
    const user = userEvent.setup();
    render(<Harness initial={CURRENT} serverError="This cover photo is no longer available." />);

    await user.clear(screen.getByLabelText(c.alt));
    await user.type(screen.getByLabelText(c.alt), 'Paper lanterns');

    expect(screen.getByTestId('cover')).toHaveTextContent('|Paper lanterns|');
    expect(screen.getByRole('alert')).toHaveTextContent('This cover photo is no longer available.');
  });
});
