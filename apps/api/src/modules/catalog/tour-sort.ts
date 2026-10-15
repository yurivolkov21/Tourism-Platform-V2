import type { ToursListQuery } from '@tourism/contract';
import type { Prisma } from '../../generated/prisma/client.js';

/** Khoá sắp nào ứng với đúng một cột của bảng `tours`. `rating` không ở đây: nó cần ba vế. */
const SORT_COLUMN = {
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  basePrice: 'basePrice',
  durationDays: 'durationDays',
  title: 'title',
} as const satisfies Record<
  Exclude<ToursListQuery['sort'], 'rating'>,
  keyof Prisma.TourOrderByWithRelationInput
>;

/**
 * `orderBy` của `catalog.tours.list`. Vế cuối luôn là `id asc` — sort phụ giữ phân trang ổn định
 * khi khoá sắp bằng nhau.
 *
 * `rating` (ADR-0058 §4): `ratingAvg` theo chiều `order`, tour chưa có đánh giá (`null`) đứng
 * cuối ở CẢ hai chiều — chưa ai chấm không phải bị chấm thấp nhất; hoà điểm thì tour nhiều đánh
 * giá hơn đứng trước (4.8 từ 120 bài đáng tin hơn 4.8 từ 3 bài).
 */
export function tourOrderBy(
  sort: ToursListQuery['sort'],
  order: ToursListQuery['order'],
): Prisma.TourOrderByWithRelationInput[] {
  if (sort === 'rating') {
    return [{ ratingAvg: { sort: order, nulls: 'last' } }, { ratingCount: 'desc' }, { id: 'asc' }];
  }
  return [{ [SORT_COLUMN[sort]]: order }, { id: 'asc' }];
}
