import { Prisma } from '../../generated/prisma/client.js';

/**
 * Money math thuần cho booking create path (spec P2 §3). Mọi thứ chạy trên
 * `Prisma.Decimal` — tiền KHÔNG BAO GIỜ đi qua float IEEE754 (CLAUDE.md / quy
 * ước catalog: decimal string trên đường truyền, Decimal trong bộ nhớ).
 */

/**
 * Giá thực một seat trên một departure: `priceOverride ?? tour.basePrice`.
 * Override bằng 0 là một mức giá thật (departure promo miễn phí), không phải
 * giá thiếu — nên dùng `??`, không phải `||`.
 */
export function effectiveUnitPrice(
  basePrice: Prisma.Decimal,
  priceOverride: Prisma.Decimal | null,
): Prisma.Decimal {
  return priceOverride ?? basePrice;
}

/**
 * Tổng booking: `unitPrice × seats`, làm tròn HALF_UP về 2 chữ số thập phân cho
 * khớp cột DB (`Decimal(14,2)`). Unit price của ta vốn đã 2dp nên việc làm tròn
 * thực tế là no-op, nhưng invariant này thuộc về helper, không phải mọi caller.
 */
export function totalAmount(unitPrice: Prisma.Decimal, seats: number): Prisma.Decimal {
  return unitPrice.mul(seats).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}
