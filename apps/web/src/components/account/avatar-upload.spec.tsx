import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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

describe('AvatarUpload — lỗi kèm tên tệp', () => {
  /** Review 09/10: lỗi in kèm tên tệp; tên dài liền một chuỗi từng làm trang 320px cuộn ngang 240px. */
  it('tên tệp dài liền một chuỗi trong câu lỗi xuống dòng được, không đẩy trang tràn ngang', () => {
    const { container } = render(<AvatarUpload initial="A" image={null} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const longName = `${'a'.repeat(80)}.txt`;

    fireEvent.change(input, {
      target: { files: [new File(['x'], longName, { type: 'text/plain' })] },
    });

    expect(screen.getByText((text) => text.startsWith(longName))).toHaveClass('wrap-anywhere');
  });
});

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

describe('AvatarUpload — dựng dọc cho thẻ danh tính (spec 09/10 §2)', () => {
  const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;

  // Hai nút cùng mở ô chọn file, nhưng chỉ nút viền là điểm dừng "Upload avatar" của bàn phím và
  // trình đọc màn hình. Ảnh tròn vẫn bấm và thả được bằng chuột mà ẩn khỏi cây trợ năng
  // (`aria-hidden`) nên không tìm được bằng role hay tên — tìm bằng thuộc tính.
  const labelledButton = () => screen.getByRole('button', { name: 'Upload avatar' });
  const photoOf = (container: HTMLElement) =>
    container.querySelector('button[aria-hidden="true"]') as HTMLButtonElement;

  it('ảnh 96px; `children` nằm GIỮA ảnh và nút "Upload avatar"; dòng gợi ý ngay dưới nút', () => {
    const { container } = render(
      <AvatarUpload initial="A" image={null}>
        <p>Minh Anh</p>
      </AvatarUpload>,
    );
    const avatar = photoOf(container);
    const name = screen.getByText('Minh Anh');
    const uploadButton = labelledButton();
    const hint = screen.getByText('PNG, JPG up to 2 MB. Click or drop a photo.');
    expect(avatar).toHaveClass('size-24');
    expect(avatar.compareDocumentPosition(name)).toBe(FOLLOWING);
    expect(name.compareDocumentPosition(uploadButton)).toBe(FOLLOWING);
    expect(uploadButton.compareDocumentPosition(hint)).toBe(FOLLOWING);
    // Chữ "Upload avatar" chỉ còn là nút viền — dòng nhãn phụ cũ (`<p>`) đã gỡ.
    expect(screen.getAllByText('Upload avatar')).toHaveLength(1);
    // User duyệt bằng mắt 09/10: nút chỉ có chữ như các nút khác của trang (Edit, Delete account).
    expect(uploadButton.querySelector('svg')).toBeNull();
  });

  it('có ảnh: không in dòng "Avatar selected"', () => {
    render(<AvatarUpload initial="A" image="https://res.cloudinary.com/demo/avatars/user-1.png" />);
    expect(screen.queryByText('Avatar selected')).not.toBeInTheDocument();
  });

  it('nút viền "Upload avatar" nhìn thấy được; bấm thì mở CÙNG ô chọn file với ảnh tròn', async () => {
    const user = userEvent.setup();
    const { container } = render(<AvatarUpload initial="A" image={null} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const openPicker = vi.spyOn(input, 'click');

    const button = labelledButton();
    expect(button).toBeVisible();
    await user.click(button);
    expect(openPicker).toHaveBeenCalledTimes(1);

    // Ảnh tròn vẫn bấm được như trước, và vẫn là ô chọn file ấy.
    await user.click(photoOf(container));
    expect(openPicker).toHaveBeenCalledTimes(2);
  });

  it('chỉ MỘT điểm dừng "Upload avatar": ảnh tròn và ô file ẩn khỏi trình đọc màn hình và khỏi thứ tự Tab', () => {
    const { container } = render(<AvatarUpload initial="A" image={null} />);
    expect(screen.getAllByRole('button', { name: 'Upload avatar' })).toHaveLength(1);

    const photo = photoOf(container);
    expect(photo).toHaveAttribute('aria-hidden', 'true');
    expect(photo).toHaveAttribute('tabindex', '-1');
    // Không còn tên riêng: hai nút trùng tên "Upload avatar" làm trình đọc màn hình đọc đôi.
    expect(photo).not.toHaveAttribute('aria-label');

    // Ô file `sr-only` vẫn focus được nếu không tắt: sẽ thành điểm Tab thứ ba, không tên.
    const input = container.querySelector('input[type="file"]');
    expect(input).toHaveAttribute('aria-hidden', 'true');
    expect(input).toHaveAttribute('tabindex', '-1');
  });

  it('Tab đi qua đúng nút viền rồi ra khỏi khối; có ảnh thì nút gỡ ảnh đứng trước nó', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<AvatarUpload initial="A" image={null} />);
    await user.tab();
    expect(labelledButton()).toHaveFocus();
    await user.tab();
    expect(document.body).toHaveFocus();
    unmount();

    render(<AvatarUpload initial="A" image="https://res.cloudinary.com/demo/avatars/user-1.png" />);
    await user.tab();
    expect(screen.getByRole('button', { name: 'Remove avatar' })).toHaveFocus();
    await user.tab();
    expect(labelledButton()).toHaveFocus();
    await user.tab();
    expect(document.body).toHaveFocus();
  });

  it('đang tải thì nút viền khoá cùng cờ `busy` với ảnh tròn; tải xong thì mở lại', async () => {
    let finish: (publicId: string) => void = () => {};
    upload.mockReturnValue(
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
    );
    const user = userEvent.setup();
    const { container } = render(<AvatarUpload initial="A" image={null} />);
    const button = labelledButton();
    expect(button).toBeEnabled();

    await user.upload(container.querySelector('input[type="file"]') as HTMLInputElement, pngFile());

    await waitFor(() => expect(button).toBeDisabled());
    expect(photoOf(container)).toBeDisabled();
    finish(UPLOADED_PUBLIC_ID);
    await waitFor(() => expect(button).toBeEnabled());
    expect(photoOf(container)).toBeEnabled();
  });
});
