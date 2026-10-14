import { ALLOWED_IMAGE_EXTENSIONS, TOUR_PHOTO_MAX_BYTES, TOUR_PHOTOS_MAX } from '@tourism/contract';
import { messages } from './messages.js';
import { IMAGE_FORMATS_COPY, joinWithOr, TOUR_PHOTO_MAX_SIZE_COPY } from './photo-upload-copy.js';

describe('joinWithOr', () => {
  it('rỗng, một, hai, nhiều tên; không dấu phẩy Oxford, giữ giọng copy cũ', () => {
    expect(joinWithOr([])).toBe('');
    expect(joinWithOr(['JPG'])).toBe('JPG');
    expect(joinWithOr(['JPG', 'PNG'])).toBe('JPG or PNG');
    expect(joinWithOr(['JPG', 'PNG', 'GIF'])).toBe('JPG, PNG or GIF');
  });
});

describe('chữ định dạng và trần ảnh admin đọc từ hằng của contract (G14)', () => {
  it('định dạng theo đúng thứ tự whitelist ký của contract, jpg và jpeg chung một tên', () => {
    // Whitelist đổi thì ca này đỏ — sửa kỳ vọng theo chữ mới, đừng sửa chữ bằng tay.
    expect(ALLOWED_IMAGE_EXTENSIONS).toEqual(['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif']);
    expect(IMAGE_FORMATS_COPY).toBe('JPG, PNG, WebP, AVIF or GIF');
  });

  it('trần cỡ in theo MB của TOUR_PHOTO_MAX_BYTES', () => {
    expect(TOUR_PHOTO_MAX_SIZE_COPY).toBe(`${TOUR_PHOTO_MAX_BYTES / (1024 * 1024)} MB`);
    expect(TOUR_PHOTO_MAX_SIZE_COPY).toBe('10 MB');
  });

  it('tab Photos và ảnh bìa bài viết in đúng các câu đã duyệt', () => {
    const photos = messages.admin.tours.editor.photos;
    const cover = messages.admin.posts.editor.cover;
    expect(photos.formats).toBe('JPG, PNG, WebP, AVIF or GIF, up to 10 MB each.');
    expect(cover.formats).toBe('JPG, PNG, WebP, AVIF or GIF, up to 10 MB.');
    expect(photos.skipped.type('boat.heic')).toBe('boat.heic isn’t a JPG, PNG, WebP, AVIF or GIF.');
    expect(photos.skipped.size('big.jpg')).toBe('big.jpg is larger than 10 MB.');
    expect(photos.skipped.full('x.jpg')).toBe(
      `x.jpg didn’t fit — a tour can have up to ${TOUR_PHOTOS_MAX} photos, and uploads still on the list count too.`,
    );
  });

  it('hai bề mặt dùng CHÍNH một câu cho file bị loại vì sai định dạng hay quá cỡ', () => {
    // So danh tính hàm (`toBe`), không so chữ in ra: hai bản chép tay giống hệt nhau vẫn qua phép
    // so chữ, mà đó đúng là thứ sẽ trôi lệch khi chỉ một bản được sửa (cùng nếp RU2).
    const photos = messages.admin.tours.editor.photos;
    const cover = messages.admin.posts.editor.cover;
    expect(cover.skipped.type).toBe(photos.skipped.type);
    expect(cover.skipped.size).toBe(photos.skipped.size);
  });
});
