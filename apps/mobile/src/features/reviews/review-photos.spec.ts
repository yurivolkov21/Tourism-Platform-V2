import { donePhotoPublicIds, type ReviewPhotoItem, validateReviewPhoto } from './review-photos';

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
