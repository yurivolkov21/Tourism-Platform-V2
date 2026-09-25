import type { MediaItem } from '@tourism/contract';

/**
 * Ảnh cho khảm bìa + dải thumb (D1), theo đúng thứ tự sẽ hiển thị — port
 * nguyên thuật toán `apps/web/src/lib/tours.ts` `tourGallery()`.
 *
 * Ba luật, mỗi luật một lý do:
 *  1. `role: 'hero'` lên đầu BẤT KỂ `sortOrder` — ảnh dẫn là ảnh biên tập
 *     chọn, không phải "ảnh có sortOrder nhỏ nhất". Không có hero thì ảnh
 *     gallery đầu tiên lên thay.
 *  2. Bỏ `type: 'VIDEO'` — D1 chỉ vẽ ảnh, chưa phát video ở đợt này.
 *  3. Bỏ `role: 'avatar' | 'body'` — không phải ảnh của chuyến đi.
 */
export function tourGallery(media: readonly MediaItem[]): MediaItem[] {
  const usable = media.filter(
    (item) => item.type === 'IMAGE' && (item.role === 'hero' || item.role === 'gallery'),
  );
  const hero = usable.filter((item) => item.role === 'hero');
  const rest = usable
    .filter((item) => item.role !== 'hero')
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return [...hero, ...rest];
}
