import { describe, expect, it } from 'vitest';
import { MAX_AVATAR_BYTES, validateAvatar } from './avatar';

// Luật chọn ảnh đại diện (mảnh avatar 12/08) — cùng khuôn validatePhoto của
// review nhưng trần riêng 2MB và chỉ MỘT file, không đếm số lượng.

describe('validateAvatar', () => {
  it('ảnh hợp lệ → null; đúng bằng trần vẫn hợp lệ', () => {
    expect(validateAvatar({ type: 'image/png', size: 1024 })).toBeNull();
    expect(validateAvatar({ type: 'image/jpeg', size: MAX_AVATAR_BYTES })).toBeNull();
  });

  it('không phải ảnh → notImage (lỗi loại đứng trước lỗi cỡ)', () => {
    expect(validateAvatar({ type: 'application/pdf', size: 10 })).toBe('notImage');
    expect(validateAvatar({ type: 'video/mp4', size: MAX_AVATAR_BYTES * 2 })).toBe('notImage');
  });

  it('quá trần 2MB → tooLarge', () => {
    expect(validateAvatar({ type: 'image/png', size: MAX_AVATAR_BYTES + 1 })).toBe('tooLarge');
  });
});
