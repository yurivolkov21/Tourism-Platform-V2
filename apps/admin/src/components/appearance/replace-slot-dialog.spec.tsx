import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AdminPhotoLibrary, SiteImageSlotKey } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';
import { toSlotVM } from '@/lib/appearance-view';
import type { SetSlotAction, SignSlotAction } from '@/lib/appearance-write';
import type { LoadPhotoLibraryAction } from '@/lib/photo-library';
import { uploadPhoto } from '@/lib/photo-upload';
import { SLOT_VERSION, siteSlotFixture, slotImage } from '@/test/appearance';
import { imageFile, signedUploadParams, uploadedPhoto } from '@/test/photo-upload';
import { ReplaceSlotDialog } from './replace-slot-dialog';

/**
 * Hộp Replace (spec P4f Appearance §6.2): mở sẵn ảnh đang dùng; tải lên ký đúng khe; chọn thư viện
 * chép alt và ghi công; hai khung xem trước; cảnh báo ảnh hẹp; dòng 7 ngày; lệnh lưu đúng hình.
 */
// Giữ phần thuần thật (đuôi file…), chỉ thay đường XHR — khuôn spec ảnh bìa bài viết.
vi.mock('@/lib/photo-upload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/photo-upload')>()),
  uploadPhoto: vi.fn(),
}));
const uploadMock = uploadPhoto as unknown as Mock;

const success = vi.fn();
const errorToast = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => success(...args),
    error: (...args: unknown[]) => errorToast(...args),
  },
}));

const t = messages.admin.appearance;
const d = t.replaceDialog;

const LIBRARY: AdminPhotoLibrary = [
  {
    destination: { id: '7a1b2c3d-0000-4000-8000-0000000000d1', name: 'Hội An' },
    photos: [
      {
        publicId: 'lib/a1',
        url: 'https://res.cloudinary.com/demo/image/upload/f_auto,q_auto/lib/a1',
        alt: 'Old town at dusk',
        width: 1200,
        height: 800,
        author: 'Jane Doe',
        license: 'CC BY-SA 4.0',
      },
    ],
  },
];

beforeEach(() => {
  uploadMock.mockReset();
  success.mockReset();
  errorToast.mockReset();
});

const fileInput = () => document.querySelector('input[type="file"]') as HTMLInputElement;

function renderDialog({
  slot = siteSlotFixture('home-hero'),
  imageKey = 'home-hero',
  setSlot = vi.fn<SetSlotAction>(),
  signUpload = vi.fn<SignSlotAction>(),
  library = null,
  onLibraryChange = vi.fn(),
  onClose = vi.fn(),
  onSettled = vi.fn(),
}: {
  slot?: Parameters<typeof toSlotVM>[0];
  imageKey?: SiteImageSlotKey;
  setSlot?: SetSlotAction;
  signUpload?: SignSlotAction;
  library?: AdminPhotoLibrary | null;
  onLibraryChange?: (library: AdminPhotoLibrary | null) => void;
  onClose?: () => void;
  onSettled?: () => void;
} = {}) {
  return render(
    <ReplaceSlotDialog
      slot={toSlotVM(slot)}
      imageKey={imageKey}
      setSlot={setSlot}
      signUpload={signUpload}
      library={library}
      onLibraryChange={onLibraryChange}
      loadLibrary={vi.fn<LoadPhotoLibraryAction>()}
      onClose={onClose}
      onSettled={onSettled}
    />,
  );
}

describe('ReplaceSlotDialog', () => {
  it('mở sẵn ảnh đang dùng: hai khung đúng khổ, alt điền sẵn, ghi công chỉ đọc', () => {
    renderDialog();
    const dialog = screen.getByRole('dialog', { name: d.title('Home · Hero') });
    expect(within(dialog).getByText(t.frames.desktop(1436, 900))).toBeInTheDocument();
    expect(within(dialog).getByText(t.frames.phone(390, 844))).toBeInTheDocument();
    expect(within(dialog).getByLabelText(d.alt)).toHaveValue('A city at sunrise');
    expect(within(dialog).getByText('Unsplash contributor · Unsplash License')).toBeInTheDocument();
    expect(within(dialog).queryByText(d.uploadedGone)).not.toBeInTheDocument();
  });

  it('khe không hiện ở điện thoại: câu thay cho khung điện thoại', () => {
    renderDialog({ slot: siteSlotFixture('auth-panel'), imageKey: 'auth-panel' });
    expect(screen.getByText(t.frames.phoneHidden)).toBeInTheDocument();
    expect(screen.getByText(t.frames.desktop(720, 900))).toBeInTheDocument();
  });

  it('chỉ đổi alt: lệnh lưu giữ ảnh đang dùng, ở phiên bản thẻ đang cầm', async () => {
    const setSlot = vi.fn<SetSlotAction>(async () => ({
      ok: true,
      slot: siteSlotFixture('home-hero'),
    }));
    const onSettled = vi.fn();
    const user = userEvent.setup();
    renderDialog({ setSlot, onSettled });

    const alt = screen.getByLabelText(d.alt);
    await user.clear(alt);
    await user.type(alt, 'Sunrise over the river');
    await user.click(screen.getByRole('button', { name: d.save }));

    await waitFor(() =>
      expect(setSlot).toHaveBeenCalledWith({
        key: 'home-hero',
        version: SLOT_VERSION,
        image: { publicId: 'tourism/catalog/site/home-hero', alt: 'Sunrise over the river' },
      }),
    );
    await waitFor(() =>
      expect(success).toHaveBeenCalledWith(t.toast.saved, {
        description: t.toast.savedBody('Home · Hero'),
      }),
    );
    expect(onSettled).toHaveBeenCalled();
  });

  it('tải lên: ký đúng khe, ảnh mới vào khung, lưu kèm metadata', async () => {
    const params = signedUploadParams('tourism/site/s1', 'pid-1');
    const signUpload = vi.fn<SignSlotAction>(async () => ({ ok: true, params }));
    uploadMock.mockResolvedValue(uploadedPhoto('tourism/site/s1/pid-1'));
    const setSlot = vi.fn<SetSlotAction>(async () => ({
      ok: true,
      slot: siteSlotFixture('home-hero'),
    }));
    const user = userEvent.setup({ applyAccept: false });
    renderDialog({ setSlot, signUpload });

    await user.upload(fileInput(), imageFile('hero.jpg'));

    expect(
      await screen.findByRole('heading', { name: new RegExp(`^${d.chosen}`) }),
    ).toBeInTheDocument();
    expect(signUpload).toHaveBeenCalledWith({ key: 'home-hero' });
    // uploadedPhoto rộng 2000 — đủ cho hero 1436, không cảnh báo.
    expect(screen.queryByText(d.narrow(2000, 1436))).not.toBeInTheDocument();
    expect(screen.getByLabelText(d.alt)).toHaveValue('');
    expect(screen.getByText(d.creditNone)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: d.save }));
    await waitFor(() =>
      expect(setSlot).toHaveBeenCalledWith({
        key: 'home-hero',
        version: SLOT_VERSION,
        image: {
          publicId: 'tourism/site/s1/pid-1',
          alt: null,
          upload: uploadedPhoto('tourism/site/s1/pid-1').upload,
        },
      }),
    );
  });

  it('chọn từ thư viện: alt và ghi công chép theo, ảnh 1200 px cho hero thì cảnh báo, khe có câu thì nhắc chọn đúng cảnh', async () => {
    const user = userEvent.setup();
    renderDialog({
      slot: siteSlotFixture('region-gallery-north-1'),
      imageKey: 'region-gallery-north-1',
      library: LIBRARY,
    });

    await user.click(screen.getByRole('button', { name: d.library }));
    const picker = await screen.findByRole('dialog', { name: d.libraryDialog.title });
    await user.click(within(picker).getByRole('checkbox'));
    await user.click(within(picker).getByRole('button', { name: d.libraryDialog.use }));

    await waitFor(() => expect(screen.getByLabelText(d.alt)).toHaveValue('Old town at dusk'));
    expect(screen.getByText('Jane Doe · CC BY-SA 4.0')).toBeInTheDocument();
    // Khung desktop của ô gallery miền Bắc 1 là 380 px — 1200 px đủ rộng.
    expect(screen.queryByText(/may look soft/)).not.toBeInTheDocument();
    expect(screen.getByText(d.captionCheck, { exact: false })).toBeInTheDocument();
  });

  it('ảnh thư viện hẹp hơn khung lớn nhất: cảnh báo kèm hai bề rộng', async () => {
    const user = userEvent.setup();
    renderDialog({ library: LIBRARY });

    await user.click(screen.getByRole('button', { name: d.library }));
    const picker = await screen.findByRole('dialog', { name: d.libraryDialog.title });
    await user.click(within(picker).getByRole('checkbox'));
    await user.click(within(picker).getByRole('button', { name: d.libraryDialog.use }));

    expect(await screen.findByText(d.narrow(1200, 1436))).toBeInTheDocument();
  });

  it('ảnh đang dùng là ảnh tải lên: dòng 7 ngày', () => {
    renderDialog({
      slot: siteSlotFixture('home-hero', {
        image: slotImage('home-hero', { publicId: 'tourism/site/s1/old', source: 'UPLOAD' }),
      }),
    });
    expect(screen.getByText(d.uploadedGone)).toBeInTheDocument();
  });

  it('khe trống mà bấm Save: nhắc chọn ảnh, không gửi lệnh', async () => {
    const setSlot = vi.fn<SetSlotAction>();
    const user = userEvent.setup();
    renderDialog({
      slot: siteSlotFixture('cta-band', { image: null, version: null }),
      imageKey: 'cta-band',
      setSlot,
    });

    expect(screen.queryByLabelText(d.alt)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: d.save }));

    expect(await screen.findByRole('alert')).toHaveTextContent(d.pickFirst);
    expect(setSlot).not.toHaveBeenCalled();
  });

  it('PHOTO_NOT_ALLOWED: ở lại hộp kèm câu báo, bỏ kho thư viện đã tải', async () => {
    const setSlot = vi.fn<SetSlotAction>(async () => ({ ok: false, code: 'PHOTO_NOT_ALLOWED' }));
    const onLibraryChange = vi.fn();
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderDialog({ setSlot, onLibraryChange, onClose });

    await user.click(screen.getByRole('button', { name: d.save }));

    expect(await screen.findByRole('alert')).toHaveTextContent(t.errors.PHOTO_NOT_ALLOWED);
    expect(onLibraryChange).toHaveBeenCalledWith(null);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ký hỏng vì máy chủ chưa cấu hình tải lên: câu riêng, không gọi Cloudinary', async () => {
    const signUpload = vi.fn<SignSlotAction>(async () => ({
      ok: false,
      code: 'MEDIA_UPLOAD_NOT_CONFIGURED',
    }));
    const user = userEvent.setup({ applyAccept: false });
    renderDialog({ signUpload });

    await user.upload(fileInput(), imageFile('hero.jpg'));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      t.signErrors.MEDIA_UPLOAD_NOT_CONFIGURED,
    );
    expect(uploadMock).not.toHaveBeenCalled();
  });
});
