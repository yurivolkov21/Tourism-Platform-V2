import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { SignedUploadParams } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { UnsavedChangesProvider } from '@/components/kit/unsaved-changes';
import type { LoadPhotoLibraryAction } from '@/lib/photo-library';
import { uploadPhoto } from '@/lib/photo-upload';
import type { SetPhotosAction, SignPhotoUploadsAction } from '@/lib/tour-photos';
import { COVER_PHOTO, DEST_A, detailFixture, TOUR_ID, VERSION } from '@/test/tour-detail';
import { TourPhotosForm } from './tour-photos-form';

/** Bước Photos (spec F18 §2g, F19 §2d.2). */
const e = messages.admin.tours.editor;
const t = e.photos;

const success = vi.fn();
vi.mock('sonner', () => ({
  toast: { success: (...args: unknown[]) => success(...args), error: vi.fn() },
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
// Giữ phần thuần thật (đuôi file…), chỉ thay đường XHR.
vi.mock('@/lib/photo-upload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/photo-upload')>()),
  uploadPhoto: vi.fn(),
}));
const uploadMock = uploadPhoto as unknown as Mock;

beforeEach(() => {
  success.mockReset();
  uploadMock.mockReset();
  // jsdom không có hai hàm này.
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
});

const SECOND = {
  ...COVER_PHOTO,
  publicId: 'tourism/catalog/destination/ha-long/2',
  alt: 'Kayaks in a lagoon',
};

const params = (n: number): SignedUploadParams => ({
  signature: 'sig',
  timestamp: 1_760_000_000,
  apiKey: 'key',
  cloudName: 'demo',
  folder: `tourism/tours/${TOUR_ID}`,
  publicId: `pid-${n}`,
  allowedFormats: 'jpg,jpeg,png,webp,avif,gif',
  transformation: 'c_limit,w_2400,h_2400,fl_force_strip',
  overwrite: false,
  uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
});
const uploaded = (n: number) => ({
  publicId: `tourism/tours/${TOUR_ID}/pid-${n}`,
  upload: { version: '1759000000', width: 2000, height: 1333, format: 'jpg', bytes: 1000 },
});
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function renderForm(
  detail = detailFixture({ photos: [COVER_PHOTO, SECOND] }),
  actions: {
    save?: SetPhotosAction;
    sign?: SignPhotoUploadsAction;
    loadLibrary?: LoadPhotoLibraryAction;
  } = {},
) {
  const save = actions.save ?? vi.fn<SetPhotosAction>();
  const sign = actions.sign ?? vi.fn<SignPhotoUploadsAction>();
  const loadLibrary = actions.loadLibrary ?? vi.fn<LoadPhotoLibraryAction>();
  const user = userEvent.setup({ applyAccept: false });
  render(<TourPhotosForm detail={detail} save={save} sign={sign} loadLibrary={loadLibrary} />);
  return { user, save: save as Mock, sign: sign as Mock };
}

const saveButton = () => screen.getByRole('button', { name: e.save });
const altInputs = () => screen.getAllByRole('textbox', { name: t.alt });
const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;
const file = (name: string, bytes = 10) =>
  new File([new Uint8Array(bytes)], name, { type: 'image/jpeg' });

describe('TourPhotosForm', () => {
  it('mở ra đủ ảnh theo thứ tự; ảnh đầu mang nhãn Cover; bộ đếm; Save khoá khi chưa sửa', () => {
    renderForm();

    expect(altInputs().map((input) => (input as HTMLInputElement).value)).toEqual([
      COVER_PHOTO.alt,
      SECOND.alt,
    ]);
    expect(screen.getAllByText(t.cover)).toHaveLength(1);
    expect(screen.getByText(t.count(2, 30))).toBeInTheDocument();
    expect(saveButton()).toHaveAttribute('aria-disabled', 'true');
  });

  it('Make cover đưa ảnh lên đầu, tiêu điểm vào ô alt của nó; Save gửi đúng thứ tự mới', async () => {
    const save = vi.fn<SetPhotosAction>().mockResolvedValue({ ok: true, detail: detailFixture() });
    const { user } = renderForm(undefined, { save });

    await user.click(screen.getByRole('button', { name: t.makeCoverFor(t.photoName(2)) }));

    expect((altInputs()[0] as HTMLInputElement).value).toBe(SECOND.alt);
    expect(altInputs()[0]).toHaveFocus();
    await user.click(saveButton());
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save.mock.calls[0]?.[0]).toEqual({
      id: TOUR_ID,
      version: VERSION,
      photos: [
        { publicId: SECOND.publicId, alt: SECOND.alt },
        { publicId: COVER_PHOTO.publicId, alt: COVER_PHOTO.alt },
      ],
    });
  });

  it('alt rỗng thì báo dưới đúng ô và không gửi', async () => {
    const { user, save } = renderForm();

    await user.clear(altInputs()[1] as HTMLElement);
    await user.click(saveButton());

    expect(screen.getByRole('alert')).toHaveTextContent(t.altRequired);
    expect(save).not.toHaveBeenCalled();
  });

  it('tour đang bán gỡ hết ảnh → lỗi của danh sách, không gửi; tiêu điểm về nút Upload photos', async () => {
    const { user, save } = renderForm(detailFixture());

    await user.click(
      screen.getByRole('button', { name: messages.admin.listEditor.remove(t.photoName(1)) }),
    );

    expect(screen.getByRole('button', { name: t.upload })).toHaveFocus();
    await user.click(saveButton());
    expect(screen.getByRole('alert')).toHaveTextContent(e.form.errors.photosOnSale);
    expect(save).not.toHaveBeenCalled();
  });

  it('tải lên: ký MỘT lần cho cả lô; ảnh tải xong nối vào cuối, alt trống; Save khoá khi còn file đang tải', async () => {
    const sign = vi
      .fn<SignPhotoUploadsAction>()
      .mockResolvedValue({ ok: true, params: [params(1), params(2)] });
    const second = deferred<ReturnType<typeof uploaded>>();
    uploadMock.mockResolvedValueOnce(uploaded(1)).mockReturnValueOnce(second.promise);
    const { user } = renderForm(undefined, { sign });

    await user.upload(fileInput(), [file('a.jpg'), file('b.jpg')]);

    expect(sign).toHaveBeenCalledWith({ id: TOUR_ID, count: 2 });
    await waitFor(() => expect(altInputs()).toHaveLength(3));
    expect((altInputs()[2] as HTMLInputElement).value).toBe('');
    expect(screen.getByText(t.waiting(1))).toBeInTheDocument();
    expect(saveButton()).toHaveAttribute('aria-disabled', 'true');

    second.resolve(uploaded(2));
    await waitFor(() => expect(altInputs()).toHaveLength(4));
    expect(screen.queryByText(t.waiting(1))).not.toBeInTheDocument();
    expect(saveButton()).not.toHaveAttribute('aria-disabled', 'true');
    // Spec §4: URL xem trước thu hồi ngay khi dòng tải xong — hai file, hai lần.
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });

  it('file sai đuôi hay quá 10 MB bị loại kèm lý do; không còn file nào thì không ký', async () => {
    const { user, sign } = renderForm();

    await user.upload(fileInput(), [file('doc.pdf'), file('huge.jpg', 10 * 1024 * 1024 + 1)]);

    expect(screen.getByText(t.skipped.type('doc.pdf'))).toBeInTheDocument();
    expect(screen.getByText(t.skipped.size('huge.jpg'))).toBeInTheDocument();
    expect(sign).not.toHaveBeenCalled();
  });

  it('lô lẫn file hỏng: chỉ ký cho file được nhận', async () => {
    // Hai file chọn, một bị loại — số chữ ký phải là số file NHẬN, không phải số file chọn.
    const sign = vi
      .fn<SignPhotoUploadsAction>()
      .mockResolvedValue({ ok: true, params: [params(1)] });
    uploadMock.mockResolvedValueOnce(uploaded(1));
    const { user } = renderForm(undefined, { sign });

    await user.upload(fileInput(), [file('doc.pdf'), file('a.jpg')]);

    expect(sign).toHaveBeenCalledWith({ id: TOUR_ID, count: 1 });
    expect(screen.getByText(t.skipped.type('doc.pdf'))).toBeInTheDocument();
    await waitFor(() => expect(altInputs()).toHaveLength(3));
  });

  it('tải hỏng → báo lỗi; Retry ký lại MỘT chữ ký rồi tải lại', async () => {
    const sign = vi
      .fn<SignPhotoUploadsAction>()
      .mockResolvedValueOnce({ ok: true, params: [params(1)] })
      .mockResolvedValueOnce({ ok: true, params: [params(9)] });
    uploadMock.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(uploaded(9));
    const { user } = renderForm(undefined, { sign });

    await user.upload(fileInput(), [file('a.jpg')]);
    await screen.findByText(t.uploadFailed('a.jpg'));
    await user.click(screen.getByRole('button', { name: t.retry }));

    expect(sign).toHaveBeenLastCalledWith({ id: TOUR_ID, count: 1 });
    await waitFor(() => expect(altInputs()).toHaveLength(3));
    // Lượt đầu cũng ký `count: 1` nên chỉ `toHaveBeenLastCalledWith` không phân biệt được —
    // phải thấy lượt ký THỨ HAI, và lượt tải lại dùng CHÍNH chữ ký mới ấy (chữ ký cũ có thể hết hạn).
    expect(sign).toHaveBeenCalledTimes(2);
    expect(uploadMock.mock.calls[1]?.[1]).toEqual(params(9));
    expect(screen.queryByText(t.uploadFailed('a.jpg'))).not.toBeInTheDocument();
  });

  it('ký hỏng → câu của mã, không có dòng tải nào', async () => {
    const sign = vi
      .fn<SignPhotoUploadsAction>()
      .mockResolvedValue({ ok: false, code: 'MEDIA_UPLOAD_NOT_CONFIGURED' });
    const { user } = renderForm(undefined, { sign });

    await user.upload(fileInput(), [file('a.jpg')]);

    expect(await screen.findByText(t.signErrors.MEDIA_UPLOAD_NOT_CONFIGURED)).toBeInTheDocument();
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it('kéo thả file vào vùng danh sách cũng tải lên', async () => {
    const sign = vi
      .fn<SignPhotoUploadsAction>()
      .mockResolvedValue({ ok: true, params: [params(1)] });
    uploadMock.mockResolvedValueOnce(uploaded(1));
    renderForm(undefined, { sign });

    fireEvent.drop(screen.getByTestId('photo-drop-zone'), {
      dataTransfer: { files: [file('a.jpg')] },
    });

    await waitFor(() => expect(sign).toHaveBeenCalledWith({ id: TOUR_ID, count: 1 }));
  });

  it('lưu thành công: toast, form nhận bản server trả về', async () => {
    const next = detailFixture({
      version: '2026-09-28T10:00:00.000Z',
      photos: [{ ...COVER_PHOTO, alt: 'Saved alt' }],
    });
    const save = vi.fn<SetPhotosAction>().mockResolvedValue({ ok: true, detail: next });
    const { user } = renderForm(detailFixture(), { save });

    await user.clear(altInputs()[0] as HTMLElement);
    await user.type(altInputs()[0] as HTMLElement, 'Saved alt');
    await user.click(saveButton());

    await waitFor(() => expect(success).toHaveBeenCalledWith(e.saved));
    expect(saveButton()).toHaveAttribute('aria-disabled', 'true');
  });

  it('Add from library: ảnh nối vào cuối, alt chép từ ảnh gốc, dòng nguồn có ghi công', async () => {
    const loadLibrary = vi.fn<LoadPhotoLibraryAction>().mockResolvedValue({
      ok: true,
      library: [
        {
          destination: { id: DEST_A, name: 'Hạ Long' },
          photos: [
            {
              publicId: 'lib/cave',
              url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/lib/cave',
              alt: 'Cave lights',
              width: 2400,
              height: 1600,
              author: 'J. Nguyen',
              license: 'CC BY-SA 4.0',
            },
          ],
        },
      ],
    });
    const { user } = renderForm(undefined, { loadLibrary });

    await user.click(screen.getByRole('button', { name: t.library }));
    await user.click(await screen.findByRole('checkbox', { name: 'Cave lights' }));
    await user.click(screen.getByRole('button', { name: messages.admin.photoLibrary.add(1) }));

    expect((altInputs()[2] as HTMLInputElement).value).toBe('Cave lights');
    expect(
      screen.getByText(`${t.fromLibrary} · ${t.credit('J. Nguyen', 'CC BY-SA 4.0')}`),
    ).toBeInTheDocument();
  });
});

describe('TourPhotosForm — PHOTO_NOT_ALLOWED (vòng review F18)', () => {
  it('câu nói gỡ ảnh thư viện vừa thêm; lần mở hộp sau tải lại thư viện (bản cũ đã sai)', async () => {
    const load = vi.fn<LoadPhotoLibraryAction>().mockResolvedValue({ ok: true, library: [] });
    const save = vi
      .fn<SetPhotosAction>()
      .mockResolvedValue({ ok: false, code: 'PHOTO_NOT_ALLOWED' });
    const { user } = renderForm(undefined, { save, loadLibrary: load });

    await user.click(screen.getByRole('button', { name: t.library }));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('button', { name: messages.admin.photoLibrary.cancel }));
    await user.type(altInputs()[1] as HTMLElement, ' at dawn');
    await user.click(saveButton());

    expect(await screen.findByText(t.errors.PHOTO_NOT_ALLOWED)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: t.library }));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
  });
});

describe('TourPhotosForm — tải lên (vòng review F18)', () => {
  type SignResult = Awaited<ReturnType<SignPhotoUploadsAction>>;
  type SaveResult = Awaited<ReturnType<SetPhotosAction>>;
  const photoAt = (i: number) => ({
    ...COVER_PHOTO,
    publicId: `tourism/catalog/destination/ha-long/${i}`,
    alt: `Photo ${i}`,
  });

  it('chọn lần hai lúc lượt đầu còn chờ ký: sức chứa đã trừ lượt đầu — không vượt 30', async () => {
    const signed = deferred<SignResult>();
    const sign = vi.fn<SignPhotoUploadsAction>().mockReturnValueOnce(signed.promise);
    const { user } = renderForm(
      detailFixture({ photos: Array.from({ length: 28 }, (_, i) => photoAt(i)) }),
      { sign },
    );

    await user.upload(fileInput(), [file('a.jpg'), file('b.jpg')]);
    await user.upload(fileInput(), [file('c.jpg')]);

    expect(sign).toHaveBeenCalledTimes(1);
    expect(screen.getByText(t.skipped.full('c.jpg'))).toBeInTheDocument();
  });

  it('lệnh ký NÉM (mạng đứt, redeploy): câu ký hỏng, không dòng nào kẹt, Save không khoá', async () => {
    const sign = vi.fn<SignPhotoUploadsAction>().mockRejectedValue(new Error('Failed to fetch'));
    const { user } = renderForm(undefined, { sign });

    await user.upload(fileInput(), [file('a.jpg')]);

    expect(await screen.findByText(t.signFailed)).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.queryByText(t.waiting(1))).toBeNull();
  });

  it('Retry mà lệnh ký NÉM: dòng quay về hỏng kèm câu ký hỏng, tiêu điểm về Retry, Save không khoá', async () => {
    const sign = vi
      .fn<SignPhotoUploadsAction>()
      .mockResolvedValueOnce({ ok: true, params: [params(1)] })
      .mockRejectedValueOnce(new Error('Failed to fetch'));
    uploadMock.mockRejectedValueOnce(new Error('network'));
    const { user } = renderForm(undefined, { sign });

    await user.upload(fileInput(), [file('a.jpg')]);
    await screen.findByText(t.uploadFailed('a.jpg'));
    await user.click(screen.getByRole('button', { name: t.retry }));

    expect(await screen.findByText(t.signFailed)).toBeInTheDocument();
    expect(screen.getByText(t.uploadFailed('a.jpg'))).toBeInTheDocument();
    // Thanh tiến độ vừa giữ tiêu điểm đã biến mất — tiêu điểm không được rơi về <body>.
    await waitFor(() => expect(screen.getByRole('button', { name: t.retry })).toHaveFocus());
    expect(screen.queryByText(t.waiting(1))).toBeNull();
  });

  it('đang lưu thì thả file không tải — ảnh tải xong lúc này sẽ bị bản vừa lưu đè mất', async () => {
    const saving = deferred<SaveResult>();
    const save = vi.fn<SetPhotosAction>().mockReturnValueOnce(saving.promise);
    const { user, sign } = renderForm(undefined, { save });

    await user.type(altInputs()[1] as HTMLElement, ' at dawn');
    await user.click(saveButton());
    fireEvent.drop(screen.getByTestId('photo-drop-zone'), {
      dataTransfer: { files: [file('a.jpg')] },
    });

    expect(await screen.findByText(t.busySaving)).toBeInTheDocument();
    expect(sign).not.toHaveBeenCalled();
    saving.resolve({ ok: true, detail: detailFixture({ photos: [COVER_PHOTO, SECOND] }) });
  });

  it('đang lưu thì Retry cũng không ký lại', async () => {
    const sign = vi
      .fn<SignPhotoUploadsAction>()
      .mockResolvedValue({ ok: true, params: [params(1)] });
    uploadMock.mockRejectedValueOnce(new Error('network'));
    const saving = deferred<SaveResult>();
    const save = vi.fn<SetPhotosAction>().mockReturnValueOnce(saving.promise);
    const { user } = renderForm(undefined, { sign, save });

    await user.upload(fileInput(), [file('a.jpg')]);
    await screen.findByText(t.uploadFailed('a.jpg'));
    await user.type(altInputs()[1] as HTMLElement, ' at dawn');
    await user.click(saveButton());
    await user.click(screen.getByRole('button', { name: t.retry }));

    expect(await screen.findByText(t.busySaving)).toBeInTheDocument();
    expect(sign).toHaveBeenCalledTimes(1);
    saving.resolve({ ok: true, detail: detailFixture({ photos: [COVER_PHOTO, SECOND] }) });
  });

  it('đang tải mà form còn sạch: bấm link rời tab bị hỏi lại', async () => {
    const sign = vi
      .fn<SignPhotoUploadsAction>()
      .mockResolvedValue({ ok: true, params: [params(1)] });
    uploadMock.mockReturnValueOnce(new Promise(() => {}));
    const user = userEvent.setup({ applyAccept: false });
    render(
      <UnsavedChangesProvider>
        <a href="/tours/ha-long-bay-cruise/itinerary">Itinerary</a>
        <TourPhotosForm
          detail={detailFixture({ photos: [COVER_PHOTO, SECOND] })}
          save={vi.fn()}
          sign={sign}
          loadLibrary={vi.fn()}
        />
      </UnsavedChangesProvider>,
    );

    await user.upload(fileInput(), [file('a.jpg')]);
    await waitFor(() => expect(uploadMock).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole('link', { name: 'Itinerary' }));

    expect(
      screen.getByRole('alertdialog', { name: messages.admin.unsavedChanges.title }),
    ).toBeInTheDocument();
  });

  it('rời tab (unmount) lúc đang tải: lượt tải đang chạy bị huỷ', async () => {
    const sign = vi
      .fn<SignPhotoUploadsAction>()
      .mockResolvedValue({ ok: true, params: [params(1)] });
    uploadMock.mockReturnValueOnce(new Promise(() => {}));
    const user = userEvent.setup({ applyAccept: false });
    const view = render(
      <TourPhotosForm
        detail={detailFixture({ photos: [COVER_PHOTO, SECOND] })}
        save={vi.fn()}
        sign={sign}
        loadLibrary={vi.fn()}
      />,
    );

    await user.upload(fileInput(), [file('a.jpg')]);
    await waitFor(() => expect(uploadMock).toHaveBeenCalledTimes(1));
    const signal = uploadMock.mock.calls[0]?.[3] as AbortSignal | undefined;
    expect(signal?.aborted).toBe(false);
    view.unmount();

    expect(signal?.aborted).toBe(true);
  });

  it('Retry: tiêu điểm sang thanh tiến độ của dòng; hỏng lần nữa thì về lại nút Retry', async () => {
    const sign = vi
      .fn<SignPhotoUploadsAction>()
      .mockResolvedValueOnce({ ok: true, params: [params(1)] })
      .mockResolvedValueOnce({ ok: true, params: [params(2)] });
    let failAgain: (error: Error) => void = () => {};
    uploadMock.mockRejectedValueOnce(new Error('network')).mockReturnValueOnce(
      new Promise((_, reject) => {
        failAgain = reject;
      }),
    );
    const { user } = renderForm(undefined, { sign });

    await user.upload(fileInput(), [file('a.jpg')]);
    await screen.findByText(t.uploadFailed('a.jpg'));
    await user.click(screen.getByRole('button', { name: t.retry }));

    await waitFor(() =>
      expect(screen.getByRole('progressbar', { name: t.uploadingLabel('a.jpg') })).toHaveFocus(),
    );
    failAgain(new Error('network'));
    await waitFor(() => expect(screen.getByRole('button', { name: t.retry })).toHaveFocus());
  });

  it('Retry tải xong lúc tiêu điểm ở thanh tiến độ: tiêu điểm vào ô alt của ảnh mới', async () => {
    const sign = vi
      .fn<SignPhotoUploadsAction>()
      .mockResolvedValueOnce({ ok: true, params: [params(1)] })
      .mockResolvedValueOnce({ ok: true, params: [params(2)] });
    const again = deferred<ReturnType<typeof uploaded>>();
    uploadMock.mockRejectedValueOnce(new Error('network')).mockReturnValueOnce(again.promise);
    const { user } = renderForm(undefined, { sign });

    await user.upload(fileInput(), [file('a.jpg')]);
    await screen.findByText(t.uploadFailed('a.jpg'));
    await user.click(screen.getByRole('button', { name: t.retry }));
    await waitFor(() => expect(screen.getByRole('progressbar')).toHaveFocus());
    again.resolve(uploaded(2));

    await waitFor(() => expect(altInputs()).toHaveLength(3));
    await waitFor(() => expect(altInputs()[2]).toHaveFocus());
  });

  it('Remove dòng hỏng: tiêu điểm sang dòng hỏng kế; hết dòng thì về nút Upload photos', async () => {
    const sign = vi
      .fn<SignPhotoUploadsAction>()
      .mockResolvedValue({ ok: true, params: [params(1), params(2)] });
    uploadMock
      .mockRejectedValueOnce(new Error('network'))
      .mockRejectedValueOnce(new Error('network'));
    const { user } = renderForm(undefined, { sign });

    await user.upload(fileInput(), [file('a.jpg'), file('b.jpg')]);
    await screen.findByText(t.uploadFailed('b.jpg'));
    await screen.findByText(t.uploadFailed('a.jpg'));
    await user.click(screen.getAllByRole('button', { name: t.remove })[0] as HTMLElement);

    expect(screen.getByRole('button', { name: t.remove })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: t.remove }));
    expect(screen.getByRole('button', { name: t.upload })).toHaveFocus();
  });
});

describe('TourPhotosForm — bước Photos (F19)', () => {
  const a = e.aside;
  const state = e.steps.state;
  const aside = () => screen.getByRole('complementary');
  const THIRD = {
    ...COVER_PHOTO,
    publicId: 'tourism/catalog/destination/ha-long/3',
    url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/v1700000000/tourism/catalog/destination/ha-long/3',
    alt: 'A cave lit in blue',
  };

  it('vùng thả file bọc cả hai nút lẫn danh sách; bộ đếm ở góc card', () => {
    renderForm();
    const zone = screen.getByTestId('photo-drop-zone');
    expect(within(zone).getByRole('button', { name: t.upload })).toBeInTheDocument();
    expect(within(zone).getByRole('button', { name: t.library })).toBeInTheDocument();
    expect(within(zone).getAllByRole('textbox', { name: t.alt })).toHaveLength(2);
    expect(screen.getByText(t.count(2, 30)).closest('[data-slot="card-action"]')).not.toBeNull();
  });

  it('cột phải theo danh sách ĐANG SOẠN: xoá một alt là dòng alt báo 1 ảnh còn thiếu', async () => {
    const { user } = renderForm();
    const rows = () => within(aside()).getAllByRole('listitem');
    expect(rows()[0]).toHaveTextContent(`${state.ok}${e.readiness.cover}${a.required}`);
    expect(rows()[1]).toHaveTextContent(`${state.ok}${a.photos.altAll}${a.photos.altDone}`);

    await user.clear(altInputs()[1] as HTMLElement);

    expect(rows()[1]).toHaveTextContent(`${state.warn}${a.photos.altAll}${a.photos.altMissing(1)}`);
  });

  it('danh sách rỗng: dòng ảnh bìa báo thiếu, khung ảnh bìa nói chưa có ảnh', () => {
    renderForm(detailFixture({ isPublished: false, photos: [] }));
    const rows = within(aside()).getAllByRole('listitem');
    // Dòng thiếu khác CHỮ dòng đủ, không chỉ khác màu icon (vòng review F19).
    expect(rows[0]).toHaveTextContent(`${state.warn}${e.readiness.cover}${a.requiredMissing}`);
    expect(within(aside()).getByText(a.preview.noCover)).toBeInTheDocument();
    // Không ảnh nào thì "alt trên mọi ảnh" đúng rỗng — không có dòng ✓ ấy (vòng review F19).
    expect(within(aside()).queryByText(a.photos.altAll)).toBeNull();
  });

  it('có ảnh: mô tả nói bước này có luật LƯU lẫn luật bán; dòng alt hiện', () => {
    renderForm(detailFixture({ photos: [COVER_PHOTO] }));
    expect(within(aside()).getByText(a.photos.checklistBody)).toBeInTheDocument();
    expect(within(aside()).queryByText(a.thisStepBody)).toBeNull();
    expect(within(aside()).getByText(a.photos.altAll)).toBeInTheDocument();
    expect(within(aside()).getByText(a.required)).toBeInTheDocument();
  });

  it('Make cover: ảnh bìa ở cột phải đổi theo ngay, trước khi lưu', async () => {
    const { user } = renderForm(detailFixture({ photos: [COVER_PHOTO, THIRD] }));
    const cover = () => aside().querySelector('img')?.getAttribute('src');
    expect(cover()).toContain('/tourism/catalog/tour/ha-long');

    await user.click(screen.getByRole('button', { name: t.makeCoverFor(t.photoName(2)) }));

    expect(cover()).toContain('/destination/ha-long/3');
  });

  it('chân form: câu hệ quả của lần lưu và link Next: Itinerary', () => {
    renderForm();
    expect(screen.getByText(a.photos.saveNote)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: e.next(e.tabs.itinerary) })).toHaveAttribute(
      'href',
      '/tours/ha-long-bay-cruise/itinerary',
    );
  });
});
