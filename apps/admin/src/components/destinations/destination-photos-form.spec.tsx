import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminDestinationPhoto, AdminDestinationPhotos } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { UnsavedChangesProvider } from '@/components/kit/unsaved-changes';
import type {
  SetDestinationPhotosAction,
  SignDestinationUploadsAction,
} from '@/lib/destination-photos';
import { uploadPhoto } from '@/lib/photo-upload';
import { imageFile, signedUploadParams, uploadedPhoto } from '@/test/photo-upload';
import { DestinationPhotosForm } from './destination-photos-form';

/** Trang Photos của một điểm đến (spec P4f Media §7.3, ADR-0060 §8). */
const t = messages.admin.destinations.photos;
const photosCopy = messages.admin.tours.editor.photos;
const save = messages.admin.tours.editor.save;

const success = vi.fn();
const errorToast = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => success(...args),
    error: (...args: unknown[]) => errorToast(...args),
  },
}));
const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push }) }));
// Giữ phần thuần thật (đuôi file…), chỉ thay đường XHR.
vi.mock('@/lib/photo-upload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/photo-upload')>()),
  uploadPhoto: vi.fn(),
}));
const uploadMock = uploadPhoto as unknown as Mock;

beforeEach(() => {
  success.mockReset();
  errorToast.mockReset();
  push.mockReset();
  uploadMock.mockReset();
  // jsdom không có hai hàm này.
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});

const DEST = '0bbbb001-0000-4000-8000-000000000001';
const VERSION = '2026-10-19T03:00:00.000Z';
const CDN = 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1';

const photo = (over: Partial<AdminDestinationPhoto>): AdminDestinationPhoto => ({
  publicId: 'tourism/catalog/destination/hoi-an/1',
  url: `${CDN}/tourism/catalog/destination/hoi-an/1`,
  alt: 'Lanterns over the river',
  width: 2400,
  height: 1600,
  source: 'CATALOG',
  usedByTours: 0,
  author: null,
  license: null,
  ...over,
});
const COVER = photo({ usedByTours: 2 });
const UPLOADED = photo({
  publicId: `tourism/destinations/${DEST}/old`,
  url: `${CDN}/tourism/destinations/${DEST}/old`,
  alt: 'Old town at dusk',
  source: 'UPLOAD',
});

const detailOf = (
  photos: AdminDestinationPhoto[] = [COVER, UPLOADED],
  over: Partial<AdminDestinationPhotos> = {},
): AdminDestinationPhotos => ({
  id: DEST,
  name: 'Hoi An',
  slug: 'hoi-an',
  isActive: true,
  version: VERSION,
  photos,
  ...over,
});

function renderForm(
  detail = detailOf(),
  actions: { save?: SetDestinationPhotosAction; sign?: SignDestinationUploadsAction } = {},
) {
  const saveAction = actions.save ?? vi.fn<SetDestinationPhotosAction>();
  const sign = actions.sign ?? vi.fn<SignDestinationUploadsAction>();
  const user = userEvent.setup({ applyAccept: false });
  render(
    <UnsavedChangesProvider>
      <DestinationPhotosForm detail={detail} save={saveAction} sign={sign} />
    </UnsavedChangesProvider>,
  );
  return { user, save: saveAction as Mock, sign: sign as Mock };
}

const saveButton = () => screen.getByRole('button', { name: save });
const altInputs = () => screen.getAllByRole('textbox', { name: photosCopy.alt });
const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;
const removeButton = (n: number) =>
  screen.getByRole('button', { name: messages.admin.listEditor.remove(photosCopy.photoName(n)) });

describe('DestinationPhotosForm', () => {
  it('tiêu đề, link về bảng, ảnh theo thứ tự với dòng nguồn; Save khoá khi chưa sửa', () => {
    renderForm();

    expect(screen.getByRole('heading', { name: t.title('Hoi An') })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.back })).toHaveAttribute('href', '/destinations');
    expect(altInputs().map((input) => (input as HTMLInputElement).value)).toEqual([
      COVER.alt,
      UPLOADED.alt,
    ]);
    expect(screen.getByText(`${t.source.CATALOG} · ${t.usedBy(2)}`)).toBeInTheDocument();
    expect(screen.getByText(t.source.UPLOAD)).toBeInTheDocument();
    expect(screen.getByText(t.count(2, 30))).toBeInTheDocument();
    expect(screen.queryByText(t.hidden)).not.toBeInTheDocument();
    expect(saveButton()).toHaveAttribute('aria-disabled', 'true');
  });

  it('điểm đến đã ẩn mang nhãn Hidden', () => {
    renderForm(detailOf(undefined, { isActive: false }));
    expect(screen.getByText(t.hidden)).toBeInTheDocument();
  });

  it('Make cover rồi Save: gửi thứ tự mới, toast, form nhận bản server', async () => {
    const saved = detailOf([UPLOADED, COVER], { version: '2026-10-19T03:05:00.000Z' });
    const { user, save: saveMock } = renderForm(undefined, {
      save: vi.fn<SetDestinationPhotosAction>().mockResolvedValue({ ok: true, detail: saved }),
    });

    await user.click(
      screen.getByRole('button', { name: photosCopy.makeCoverFor(photosCopy.photoName(2)) }),
    );
    expect(altInputs()[0]).toHaveFocus();
    await user.click(saveButton());

    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
    expect(saveMock.mock.calls[0]?.[0]).toEqual({
      id: DEST,
      version: VERSION,
      photos: [
        { publicId: UPLOADED.publicId, alt: UPLOADED.alt },
        { publicId: COVER.publicId, alt: COVER.alt },
      ],
    });
    expect(success).toHaveBeenCalledWith(t.toast.title, { description: t.toast.body('Hoi An') });
    expect(saveButton()).toHaveAttribute('aria-disabled', 'true');
  });

  it('gỡ ảnh: khối "rời thư viện" nói hậu quả của từng ảnh; Put back trả ảnh về cuối danh sách', async () => {
    const { user } = renderForm();

    await user.click(removeButton(2));
    await user.click(removeButton(1));

    const section = screen.getByRole('region', { name: t.removed.title });
    expect(within(section).getByText(t.removed.upload)).toBeInTheDocument();
    expect(
      within(section).getByText(`${t.removed.usedByTours(2)} ${t.removed.catalog}`),
    ).toBeInTheDocument();

    await user.click(
      within(section).getByRole('button', { name: t.removed.putBackFor(UPLOADED.alt ?? '') }),
    );
    expect(altInputs().map((input) => (input as HTMLInputElement).value)).toEqual([UPLOADED.alt]);
    expect(altInputs()[0]).toHaveFocus();
    expect(within(section).queryByText(t.removed.upload)).not.toBeInTheDocument();
  });

  it('gỡ hết ảnh của điểm đến đang hiện: hỏi lại trước khi lưu; Keep editing không gửi', async () => {
    const { user, save: saveMock } = renderForm(detailOf([COVER]), {
      save: vi.fn<SetDestinationPhotosAction>().mockResolvedValue({
        ok: true,
        detail: detailOf([]),
      }),
    });

    await user.click(removeButton(1));
    await user.click(saveButton());
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent(t.emptyConfirm.body('Hoi An'));
    await user.click(within(dialog).getByRole('button', { name: t.emptyConfirm.cancel }));
    expect(saveMock).not.toHaveBeenCalled();

    await user.click(saveButton());
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: t.emptyConfirm.confirm,
      }),
    );
    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
    expect(saveMock.mock.calls[0]?.[0]).toMatchObject({ photos: [] });
  });

  it('điểm đến đã ẩn: lưu danh sách rỗng không hỏi lại', async () => {
    const { user, save: saveMock } = renderForm(detailOf([COVER], { isActive: false }), {
      save: vi.fn<SetDestinationPhotosAction>().mockResolvedValue({
        ok: true,
        detail: detailOf([], { isActive: false }),
      }),
    });

    await user.click(removeButton(1));
    await user.click(saveButton());
    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('STALE_DESTINATION: dải báo của điểm đến kèm Reload; chữ đang sửa còn nguyên', async () => {
    const { user } = renderForm(undefined, {
      save: vi
        .fn<SetDestinationPhotosAction>()
        .mockResolvedValue({ ok: false, code: 'STALE_DESTINATION' }),
    });

    await user.type(altInputs()[0] as HTMLElement, ' and boats');
    await user.click(saveButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(t.stale);
    expect(within(alert).getByRole('button', { name: 'Reload' })).toBeInTheDocument();
    expect((altInputs()[0] as HTMLInputElement).value).toBe(`${COVER.alt} and boats`);
  });

  it('NOT_FOUND: toast rồi về bảng điểm đến', async () => {
    const { user } = renderForm(undefined, {
      save: vi.fn<SetDestinationPhotosAction>().mockResolvedValue({ ok: false, code: 'NOT_FOUND' }),
    });

    await user.type(altInputs()[0] as HTMLElement, '!');
    await user.click(saveButton());

    await waitFor(() => expect(push).toHaveBeenCalledWith('/destinations'));
    expect(errorToast).toHaveBeenCalledWith(t.errors.NOT_FOUND);
  });

  it('lệnh lưu ném: dải đỏ không rõ kết cục kèm Reload', async () => {
    const { user } = renderForm(undefined, {
      save: vi.fn<SetDestinationPhotosAction>().mockRejectedValue(new Error('network')),
    });

    await user.type(altInputs()[0] as HTMLElement, '!');
    await user.click(saveButton());

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(messages.admin.errors.write.GENERIC);
    expect(within(alert).getByRole('button', { name: 'Reload' })).toBeInTheDocument();
  });

  it('tải lên vào thư mục của điểm đến: ảnh mới nối cuối, alt trống, nhãn Uploaded; Save gửi kèm metadata', async () => {
    const publicId = `tourism/destinations/${DEST}/fresh`;
    const sign = vi.fn<SignDestinationUploadsAction>().mockResolvedValue({
      ok: true,
      params: [signedUploadParams(`tourism/destinations/${DEST}`, 'fresh')],
    });
    uploadMock.mockResolvedValue(uploadedPhoto(publicId));
    const { user, save: saveMock } = renderForm(undefined, {
      sign,
      save: vi.fn<SetDestinationPhotosAction>().mockResolvedValue({ ok: true, detail: detailOf() }),
    });

    await user.upload(fileInput(), [imageFile('fresh.jpg')]);

    await waitFor(() => expect(altInputs()).toHaveLength(3));
    expect(sign).toHaveBeenCalledWith({ id: DEST, count: 1 });
    expect(altInputs()[2]).toHaveValue('');
    await user.type(altInputs()[2] as HTMLElement, 'Fresh photo');
    await user.click(saveButton());

    await waitFor(() => expect(saveMock).toHaveBeenCalledTimes(1));
    expect(saveMock.mock.calls[0]?.[0].photos[2]).toEqual({
      publicId,
      alt: 'Fresh photo',
      upload: uploadedPhoto(publicId).upload,
    });
  });

  it('ký hỏng vì thiếu cấu hình: câu của mã; file vượt trần: câu nói về điểm đến', async () => {
    const full = Array.from({ length: 30 }, (_, i) =>
      photo({ publicId: `tourism/catalog/destination/hoi-an/${i}`, alt: `Photo ${i}` }),
    );
    renderForm(detailOf(full.slice(0, 29)), {
      sign: vi
        .fn<SignDestinationUploadsAction>()
        .mockResolvedValue({ ok: false, code: 'MEDIA_UPLOAD_NOT_CONFIGURED' }),
    });
    const user = userEvent.setup({ applyAccept: false });

    await user.upload(fileInput(), [imageFile('a.jpg'), imageFile('b.jpg')]);

    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent(t.skippedFull('b.jpg'));
    expect(status).toHaveTextContent(t.signErrors.MEDIA_UPLOAD_NOT_CONFIGURED);
  });
});
