import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewComposer } from './review-composer';

const { signUpload, create } = vi.hoisted(() => ({
  signUpload: vi.fn(),
  create: vi.fn(),
}));
vi.mock('@/lib/api/client', () => ({
  api: { media: { signUpload }, reviews: { create } },
  withBrowserAuth: () => ({ auth: { credentials: 'include' } }),
}));

const { upload } = vi.hoisted(() => ({ upload: vi.fn() }));
vi.mock('@/lib/media-upload', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/media-upload')>()),
  uploadToCloudinary: upload,
}));

const { refresh } = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const CODE = 'BK-COMPOSE01';
const SIGNED_PARAMS = {
  signature: 'sig',
  timestamp: 1_700_000_000,
  apiKey: 'key',
  cloudName: 'demo',
  folder: 'reviews',
  publicId: 'trip-1',
  uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
};
const UPLOADED_PUBLIC_ID = 'reviews/trip-1';

beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => 'blob:preview');
  URL.revokeObjectURL = vi.fn();
  signUpload.mockResolvedValue(SIGNED_PARAMS);
  upload.mockResolvedValue(UPLOADED_PUBLIC_ID);
  create.mockResolvedValue({});
});

function pngFile(name = 'trip.png') {
  return new File(['x'], name, { type: 'image/png' });
}

describe('ReviewComposer — cầu nối state ảnh → form', () => {
  it('thả 1 file, chờ upload xong, submit → create nhận đúng publicId Cloudinary trả về', async () => {
    const user = userEvent.setup();
    const { container } = render(<ReviewComposer bookingCode={CODE} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(input, pngFile());

    await waitFor(() => expect(upload).toHaveBeenCalled());
    expect(signUpload).toHaveBeenCalledWith(
      { purpose: 'REVIEW_PHOTO', ext: 'png', bookingCode: CODE },
      { context: { auth: { credentials: 'include' } } },
    );

    await user.click(screen.getByRole('radio', { name: '5 stars' }));
    await user.type(screen.getByLabelText(/your review/i), 'A trip with photos attached.');
    await user.click(screen.getByRole('button', { name: /submit review/i }));

    await waitFor(() =>
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({ photos: [UPLOADED_PUBLIC_ID] }),
        expect.anything(),
      ),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('upload thất bại → gỡ ảnh khỏi hàng chờ, hiện Alert errUpload, submit không nhận publicId nào', async () => {
    upload.mockRejectedValue(new Error('Cloudinary upload failed (network)'));
    const user = userEvent.setup();
    const { container } = render(<ReviewComposer bookingCode={CODE} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(input, pngFile());

    // Alert dùng đúng chuỗi errUpload từ @tourism/i18n (`${file.name}: ${errUpload}`).
    expect(
      await screen.findByText('trip.png: Upload failed. Please try again.'),
    ).toBeInTheDocument();
    // Ảnh lỗi bị gỡ khỏi hàng chờ preview — không còn <img> nào trong DOM.
    expect(container.querySelector('img')).not.toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '5 stars' }));
    await user.type(screen.getByLabelText(/your review/i), 'A trip without photos attached.');
    await user.click(screen.getByRole('button', { name: /submit review/i }));

    // Submit vẫn chạy được (nút không bị khoá vì busy) nhưng payload không
    // mang publicId nào — ReviewForm chỉ gắn key `photos` khi mảng > 0 phần
    // tử (review-form.tsx), nên hàng chờ rỗng nghĩa là key `photos` vắng mặt.
    await waitFor(() => expect(create).toHaveBeenCalled());
    expect(create.mock.calls[0]?.[0]).not.toHaveProperty('photos');
  });

  it('còn ảnh đang upload → nút submit disabled cho tới khi xong', async () => {
    let resolveUpload: (publicId: string) => void = () => {};
    upload.mockReturnValueOnce(
      new Promise<string>((resolve) => {
        resolveUpload = resolve;
      }),
    );
    const user = userEvent.setup();
    const { container } = render(<ReviewComposer bookingCode={CODE} />);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;

    await user.upload(input, pngFile());
    await waitFor(() => expect(upload).toHaveBeenCalled());

    expect(screen.getByRole('button', { name: /submit review/i })).toBeDisabled();

    resolveUpload(UPLOADED_PUBLIC_ID);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /submit review/i })).not.toBeDisabled(),
    );
  });
});
