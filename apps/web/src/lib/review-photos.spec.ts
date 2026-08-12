import { describe, expect, it } from 'vitest';
import { formatBytes, MAX_PHOTO_BYTES, MAX_PHOTOS, validatePhoto } from './review-photos';

// Luật chọn ảnh review (mảnh 1 cụm review-ảnh, 12/08) — logic thuần tách khỏi
// component để TDD: đúng loại ảnh → trần dung lượng → trần số lượng, trả mã
// lỗi để component tra i18n (không nhét copy vào lib).

describe('validatePhoto', () => {
  const okFile = { type: 'image/jpeg', size: 1024 };

  it('file hợp lệ → null', () => {
    expect(validatePhoto(okFile, 0)).toBeNull();
  });

  it('không phải ảnh → notImage (kể cả khi các trần khác cũng vỡ — lỗi loại đứng trước)', () => {
    expect(validatePhoto({ type: 'application/pdf', size: 1024 }, 0)).toBe('notImage');
    expect(validatePhoto({ type: 'video/mp4', size: MAX_PHOTO_BYTES + 1 }, MAX_PHOTOS)).toBe(
      'notImage',
    );
  });

  it('quá trần dung lượng → tooLarge; đúng bằng trần thì vẫn hợp lệ', () => {
    expect(validatePhoto({ type: 'image/png', size: MAX_PHOTO_BYTES + 1 }, 0)).toBe('tooLarge');
    expect(validatePhoto({ type: 'image/png', size: MAX_PHOTO_BYTES }, 0)).toBeNull();
  });

  it('đủ trần số lượng → tooMany', () => {
    expect(validatePhoto(okFile, MAX_PHOTOS)).toBe('tooMany');
    expect(validatePhoto(okFile, MAX_PHOTOS - 1)).toBeNull();
  });
});

describe('formatBytes', () => {
  it('đổi đơn vị đọc được: 0 · KB · MB', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(10 * 1024 * 1024)).toBe('10 MB');
    expect(formatBytes(1536)).toBe('1.5 KB');
  });
});
