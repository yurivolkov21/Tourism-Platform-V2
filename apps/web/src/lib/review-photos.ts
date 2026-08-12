import { REVIEW_PHOTO_MAX_BYTES, REVIEW_PHOTOS_MAX } from '@tourism/contract';

/**
 * Luật chọn ảnh review (mảnh 1 cụm review-ảnh, 12/08) — logic thuần tách
 * khỏi component upload để TDD được. Hai trần đọc từ contract (ADR-0021) —
 * client và server đọc MỘT nguồn, đổi số đổi một chỗ; lời hứa "server sẽ
 * dùng cùng hai trần này" ở bản trước giờ đã thành sự thật.
 */

/** Re-export từ contract (ADR-0021) — client/server đọc MỘT nguồn trần. */
export const MAX_PHOTOS = REVIEW_PHOTOS_MAX;
/** Re-export từ contract (ADR-0021) — client/server đọc MỘT nguồn trần. */
export const MAX_PHOTO_BYTES = REVIEW_PHOTO_MAX_BYTES;

export type PhotoError = 'notImage' | 'tooLarge' | 'tooMany';

/**
 * Kiểm tra MỘT file trước khi nhận vào hàng chờ — trả mã lỗi để component
 * tra i18n (copy không sống trong lib). Thứ tự: loại → dung lượng → số
 * lượng; `currentCount` là số ảnh ĐÃ nhận trước file này.
 */
export function validatePhoto(
  file: { type: string; size: number },
  currentCount: number,
): PhotoError | null {
  if (!file.type.startsWith('image/')) return 'notImage';
  if (file.size > MAX_PHOTO_BYTES) return 'tooLarge';
  if (currentCount >= MAX_PHOTOS) return 'tooMany';
  return null;
}

/** '10 MB' · '1.5 KB' — nhãn dung lượng gọn cho copy hướng dẫn + progress. */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${units[i] ?? 'B'}`;
}
