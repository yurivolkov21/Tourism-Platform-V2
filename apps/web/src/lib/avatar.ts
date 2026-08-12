import { AVATAR_MAX_BYTES } from '@tourism/contract';

/**
 * Luật chọn ảnh đại diện (mảnh avatar 12/08) — logic thuần tách khỏi
 * component để TDD, cùng khuôn `review-photos.ts`. Trần đọc từ contract
 * (ADR-0021) — client và server đọc MỘT nguồn trần, đổi số đổi một chỗ;
 * lời hứa "server sẽ dùng cùng trần" ở bản trước giờ đã thành sự thật.
 */

/** Re-export từ contract (ADR-0021) — client/server đọc MỘT nguồn trần. */
export const MAX_AVATAR_BYTES = AVATAR_MAX_BYTES;

export type AvatarError = 'notImage' | 'tooLarge';

/** Một file duy nhất: đúng loại ảnh → trần dung lượng; trả mã lỗi để
 *  component tra i18n. */
export function validateAvatar(file: { type: string; size: number }): AvatarError | null {
  if (!file.type.startsWith('image/')) return 'notImage';
  if (file.size > MAX_AVATAR_BYTES) return 'tooLarge';
  return null;
}
