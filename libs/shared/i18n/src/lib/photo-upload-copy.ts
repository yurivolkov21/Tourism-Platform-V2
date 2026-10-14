import { ALLOWED_IMAGE_EXTENSIONS, TOUR_PHOTO_MAX_BYTES } from '@tourism/contract';

/**
 * Tên in ra của từng đuôi ảnh mà contract cho ký (G14). Khoá theo kiểu của
 * `ALLOWED_IMAGE_EXTENSIONS`, nên contract thêm một đuôi mà quên tên ở đây là lỗi typecheck,
 * không phải một câu "JPG, PNG…" lặng lẽ nói thiếu. `jpg` và `jpeg` cùng một tên.
 */
const IMAGE_FORMAT_NAMES: Record<(typeof ALLOWED_IMAGE_EXTENSIONS)[number], string> = {
  jpg: 'JPG',
  jpeg: 'JPG',
  png: 'PNG',
  webp: 'WebP',
  avif: 'AVIF',
  gif: 'GIF',
};

/**
 * `['A']` → `'A'`; `['A', 'B']` → `'A or B'`; `['A', 'B', 'C']` → `'A, B or C'`. Không dấu phẩy
 * Oxford, đúng giọng các câu đã duyệt.
 */
export function joinWithOr(names: readonly string[]): string {
  const last = names[names.length - 1] ?? '';
  return names.length <= 1 ? last : `${names.slice(0, -1).join(', ')} or ${last}`;
}

/**
 * "JPG, PNG, WebP, AVIF or GIF": các định dạng admin tải lên được, theo thứ tự whitelist ký của
 * contract. Trước G14 câu này chép tay ở bốn chỗ của tab Photos và ảnh bìa bài viết.
 */
export const IMAGE_FORMATS_COPY = joinWithOr([
  ...new Set(ALLOWED_IMAGE_EXTENSIONS.map((extension) => IMAGE_FORMAT_NAMES[extension])),
]);

/** "10 MB": trần một ảnh admin tải lên (`TOUR_PHOTO_MAX_BYTES`; ảnh bìa bài viết dùng chung trần). */
export const TOUR_PHOTO_MAX_SIZE_COPY = `${TOUR_PHOTO_MAX_BYTES / (1024 * 1024)} MB`;
