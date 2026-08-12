import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AvatarUpload } from './avatar-upload';

const { signUpload, setAvatar } = vi.hoisted(() => ({
  signUpload: vi.fn(),
  setAvatar: vi.fn(),
}));
vi.mock('@/lib/api/client', () => ({
  api: { media: { signUpload }, account: { setAvatar } },
  withBrowserAuth: () => ({ auth: { credentials: 'include' } }),
}));

const { upload } = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock('@/lib/media-upload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/media-upload')>()),
  uploadToCloudinary: upload,
}));

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const SIGNED_PARAMS = {
  signature: 'sig',
  timestamp: 1_700_000_000,
  apiKey: 'key',
  cloudName: 'demo',
  folder: 'avatars',
  publicId: 'user-1',
  uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
};
const UPLOADED_PUBLIC_ID = 'avatars/user-1';

/** jsdom (bản pin repo) không hiện thực createObjectURL/revokeObjectURL —
 *  component gọi hai hàm này ngay lúc chọn file để preview cục bộ. */
beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
  signUpload.mockResolvedValue(SIGNED_PARAMS);
  upload.mockResolvedValue(UPLOADED_PUBLIC_ID);
  setAvatar.mockResolvedValue({ image: 'https://res.cloudinary.com/demo/avatars/user-1.png' });
});

function pngFile(name = 'me.png') {
  return new File(['x'], name, { type: 'image/png' });
}

describe('AvatarUpload — chọn file hợp lệ → sign → upload → setAvatar → refresh', () => {
  it('chọn png hợp lệ chạy trọn luồng ký-tải-lưu', async () => {
    const user = userEvent.setup();
    const { container } = render(<AvatarUpload initial="A" image={null} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(input, pngFile());

    await waitFor(() => expect(setAvatar).toHaveBeenCalled());

    expect(signUpload).toHaveBeenCalledWith(
      { purpose: 'AVATAR', ext: 'png' },
      { context: { auth: { credentials: 'include' } } },
    );
    expect(upload).toHaveBeenCalledWith(expect.any(File), SIGNED_PARAMS, expect.any(Function));
    expect(setAvatar).toHaveBeenCalledWith(
      { publicId: UPLOADED_PUBLIC_ID },
      { context: { auth: { credentials: 'include' } } },
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
});

describe('AvatarUpload — prop image đã lưu', () => {
  it('render ảnh đã lưu + nút gỡ', () => {
    const image = 'https://res.cloudinary.com/demo/avatars/user-1.png';
    const { container } = render(<AvatarUpload initial="A" image={image} />);

    // `alt=""` cố ý (ảnh trang trí, tên/nhãn kế bên gánh phần đọc máy) nên
    // ảnh KHÔNG lộ trong accessibility tree — query thẳng qua DOM.
    expect(container.querySelector('img')).toHaveAttribute('src', image);
    expect(screen.getByRole('button', { name: /remove avatar/i })).toBeInTheDocument();
  });
});

describe('AvatarUpload — bấm gỡ', () => {
  it('gọi setAvatar publicId null rồi refresh', async () => {
    const user = userEvent.setup();
    const image = 'https://res.cloudinary.com/demo/avatars/user-1.png';
    render(<AvatarUpload initial="A" image={image} />);

    await user.click(screen.getByRole('button', { name: /remove avatar/i }));

    await waitFor(() =>
      expect(setAvatar).toHaveBeenCalledWith(
        { publicId: null },
        { context: { auth: { credentials: 'include' } } },
      ),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
});

describe('AvatarUpload — upload thất bại', () => {
  it('hiện lỗi upload, KHÔNG gọi setAvatar', async () => {
    upload.mockRejectedValue(new Error('Cloudinary upload failed (network)'));
    const user = userEvent.setup();
    const { container } = render(<AvatarUpload initial="A" image={null} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(input, pngFile());

    expect(await screen.findByText('Upload failed. Please try again.')).toBeInTheDocument();
    expect(setAvatar).not.toHaveBeenCalled();
  });
});
