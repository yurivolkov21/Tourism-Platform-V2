import { REVIEW_PHOTO_MAX_BYTES, REVIEW_PHOTOS_MAX } from '@tourism/contract';
import {
  donePhotoPublicIds,
  formatMegabytes,
  type ReviewPhotoItem,
  reviewPhotoErrorText,
  validateReviewPhoto,
} from './review-photos';

const MB = 1024 * 1024;

describe('validateReviewPhoto', () => {
  it('chặn khi đã đủ 5 ảnh', () => {
    expect(validateReviewPhoto({ mimeType: 'image/jpeg', fileSize: MB }, 5)).toBe('tooMany');
  });

  it('chặn khi không phải ảnh whitelist', () => {
    expect(validateReviewPhoto({ mimeType: 'application/pdf', fileSize: MB }, 0)).toBe('notImage');
    expect(validateReviewPhoto({ mimeType: null, fileSize: MB }, 0)).toBe('notImage');
  });

  it('chặn khi vượt 10 MB, cho qua khi thiếu fileSize', () => {
    expect(validateReviewPhoto({ mimeType: 'image/png', fileSize: 11 * MB }, 0)).toBe('tooLarge');
    expect(validateReviewPhoto({ mimeType: 'image/png', fileSize: null }, 0)).toBeNull();
  });

  it('cho qua ảnh hợp lệ khi còn chỗ', () => {
    expect(validateReviewPhoto({ mimeType: 'image/webp', fileSize: 2 * MB }, 4)).toBeNull();
  });
});

describe('donePhotoPublicIds', () => {
  const base = { uri: 'file:///a.jpg', ext: 'jpg' as const };
  const photo = (over: Partial<ReviewPhotoItem>): ReviewPhotoItem => ({
    key: 'k',
    status: 'done',
    publicId: 'reviews/BK/a',
    ...base,
    ...over,
  });

  it('trả đúng thứ tự id khi mọi ảnh đã xong', () => {
    const photos = [photo({ key: '1', publicId: 'p1' }), photo({ key: '2', publicId: 'p2' })];
    expect(donePhotoPublicIds(photos)).toEqual(['p1', 'p2']);
  });

  it('trả null khi còn ảnh đang tải hoặc lỗi', () => {
    expect(donePhotoPublicIds([photo({ status: 'uploading', publicId: null })])).toBeNull();
    expect(donePhotoPublicIds([photo({ status: 'error', publicId: null })])).toBeNull();
  });

  it('trả mảng rỗng khi chưa có ảnh nào', () => {
    expect(donePhotoPublicIds([])).toEqual([]);
  });
});

describe('reviewPhotoErrorText (số trong câu đọc trần của contract)', () => {
  // Copy giả: test khoá SỐ truyền vào câu, không khoá chữ.
  const copy = {
    errNotImage: 'not an image',
    errTooLarge: (size: string) => `max size ${size}`,
    errTooMany: (max: number) => `max ${max} photos`,
  };

  it('quá dung lượng → câu mang trần `REVIEW_PHOTO_MAX_BYTES` viết theo MB', () => {
    expect(reviewPhotoErrorText('tooLarge', copy)).toBe(
      `max size ${formatMegabytes(REVIEW_PHOTO_MAX_BYTES)}`,
    );
    expect(formatMegabytes(REVIEW_PHOTO_MAX_BYTES)).toBe('10 MB');
  });

  it('quá số ảnh → câu mang trần `REVIEW_PHOTOS_MAX`', () => {
    expect(reviewPhotoErrorText('tooMany', copy)).toBe(`max ${REVIEW_PHOTOS_MAX} photos`);
  });

  it('không phải ảnh → câu riêng, không có số', () => {
    expect(reviewPhotoErrorText('notImage', copy)).toBe('not an image');
  });
});

describe('formatMegabytes', () => {
  it('viết số MB gọn như `formatBytes` của web: bỏ ".0", giữ một chữ số lẻ', () => {
    expect(formatMegabytes(10 * MB)).toBe('10 MB');
    expect(formatMegabytes(1.5 * MB)).toBe('1.5 MB');
  });
});
