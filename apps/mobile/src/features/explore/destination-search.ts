import type { Destination } from '@tourism/contract';
import { foldAccents } from '@tourism/contract';

/**
 * Lọc địa danh cho ô tìm chung (E2, handoff §1/§6.2): khớp ĐẦU TỪ và BỎ DẤU —
 * "ha" ra Hà Nội/Hạ Long/Hà Giang, KHÔNG ra Mai Châu hay Phong Nha dù chuỗi
 * "ha" nằm giữa từ "Nha". Chỉ 18 địa danh trong seed, lọc ở máy là đủ (không
 * cần API riêng).
 */
export function matchDestinationsByPrefix(
  destinations: readonly Destination[],
  query: string,
): Destination[] {
  const queryWords = foldAccents(query.trim())
    .split(' ')
    .filter((w) => w !== '');
  if (queryWords.length === 0) return [];

  return destinations.filter((d) => {
    const nameWords = foldAccents(d.name).split(' ');
    // MỖI từ trong query phải khớp đầu MỘT từ nào đó của tên (đa từ, không cần
    // đúng thứ tự) — "ha long" khớp "Hạ Long" nhưng "ha" một mình không khớp
    // "Phong Nha" (không từ nào của "phong nha" bắt đầu bằng "ha").
    return queryWords.every((qw) => nameWords.some((nw) => nw.startsWith(qw)));
  });
}
