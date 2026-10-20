import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { messages } from '@tourism/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReviewPhotoUpload } from './review-photo-upload';

vi.mock('@/lib/api/client', () => ({
  api: { media: { signUpload: vi.fn() } },
  withBrowserAuth: () => ({ auth: { credentials: 'include' } }),
}));

const t = messages.reviews.photos;

beforeEach(() => {
  // jsdom không có object URL; nút gỡ revoke preview của ô vừa gỡ.
  URL.revokeObjectURL = vi.fn();
});

const PHOTO = {
  publicId: 'tourism/reviews/BK-PHOTOS01/p1',
  url: 'https://res.cloudinary.com/demo/image/upload/p1.jpg',
};

/**
 * Hai nút trên mỗi ô ảnh (tay nắm sắp xếp, nút gỡ) mờ hẳn cho tới khi hover.
 * Tailwind v4 bọc `hover:` trong `@media (hover: hover)`, nên trên điện thoại
 * chúng KHÔNG BAO GIỜ hiện, và người dùng bàn phím tab vào một nút vô hình
 * (review L5). Test canh hai lối hiện còn lại: focus bên trong ô, và màn cảm ứng.
 */
describe('ReviewPhotoUpload — nút trên ô ảnh không chỉ hiện khi hover', () => {
  function renderWithPhoto() {
    const onPhotosChange = vi.fn();
    render(
      <ReviewPhotoUpload
        bookingCode="BK-PHOTOS01"
        initialPhotos={[PHOTO]}
        onPhotosChange={onPhotosChange}
      />,
    );
    return onPhotosChange;
  }

  it('nút gỡ hiện khi focus nằm trong ô và luôn hiện trên màn cảm ứng', () => {
    renderWithPhoto();
    expect(screen.getByRole('button', { name: t.removePhoto })).toHaveClass(
      'group-focus-within/item:opacity-100',
      'pointer-coarse:opacity-100',
    );
  });

  it('tay nắm sắp xếp cũng vậy', () => {
    renderWithPhoto();
    const handle = screen
      .getByRole('button', { name: t.reorderHandle })
      .closest('[data-slot="sortable-item-handle"]');
    expect(handle).toHaveClass('group-focus-within/item:opacity-100', 'pointer-coarse:opacity-100');
  });

  it('gỡ bằng bàn phím được: focus nút gỡ rồi Enter là ảnh rời hàng', async () => {
    const user = userEvent.setup();
    const onPhotosChange = renderWithPhoto();
    expect(screen.getByRole('img', { name: messages.reviews.keptPhoto })).toBeInTheDocument();

    screen.getByRole('button', { name: t.removePhoto }).focus();
    await user.keyboard('{Enter}');

    expect(screen.queryByRole('img', { name: messages.reviews.keptPhoto })).not.toBeInTheDocument();
    expect(onPhotosChange).toHaveBeenLastCalledWith({ publicIds: [], busy: false });
  });
});
