/**
 * Luật chọn ảnh đại diện (mảnh avatar 12/08) — logic thuần tách khỏi
 * component để TDD, cùng khuôn `review-photos.ts`. Trần 2MB theo mẫu UI
 * user chọn; mảnh backend (Cloudinary signed upload — chung ADR bề mặt ghi
 * media với ảnh review) sẽ dùng CÙNG trần này phía server.
 */

export const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

export type AvatarError = 'notImage' | 'tooLarge';

/** Một file duy nhất: đúng loại ảnh → trần dung lượng; trả mã lỗi để
 *  component tra i18n. */
export function validateAvatar(file: { type: string; size: number }): AvatarError | null {
  if (!file.type.startsWith('image/')) return 'notImage';
  if (file.size > MAX_AVATAR_BYTES) return 'tooLarge';
  return null;
}
