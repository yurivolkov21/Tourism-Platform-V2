import type { CostItemLike } from '@tourism/contract';
import type { Prisma } from '../../generated/prisma/client.js';
import type { TourCostBasis } from '../../generated/prisma/enums.js';

/**
 * Hàng `tour_cost_items` đọc từ Prisma → hình dạng mà ba hàm giá vốn của
 * contract nhận (ADR-0047 §8). Một chỗ duy nhất đổi `Decimal` ra chuỗi.
 *
 * `toFixed(2)` chứ không `toString()`: Decimal.js in dạng số mũ cho giá trị rất
 * nhỏ hoặc rất lớn, còn `toCents` chỉ hiểu dạng thập phân thường.
 */
export function costItemsOf(
  rows: readonly { amount: Prisma.Decimal; basis: TourCostBasis }[],
): CostItemLike[] {
  return rows.map((row) => ({ amount: row.amount.toFixed(2), basis: row.basis }));
}
