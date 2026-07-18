import { Prisma } from '../../generated/prisma/client.js';

/**
 * Pure money math for the booking create path (spec P2 §3). Everything runs on
 * `Prisma.Decimal` — money NEVER transits IEEE754 floats (CLAUDE.md / catalog
 * convention: decimal strings on the wire, Decimal in memory).
 */

/**
 * The price one seat actually costs on a departure:
 * `priceOverride ?? tour.basePrice`. A 0 override is a real price (free promo
 * departure), not a missing one — hence `??`, not `||`.
 */
export function effectiveUnitPrice(
  basePrice: Prisma.Decimal,
  priceOverride: Prisma.Decimal | null,
): Prisma.Decimal {
  return priceOverride ?? basePrice;
}

/**
 * Booking total: `unitPrice × seats`, rounded HALF_UP to 2dp to match the DB
 * column (`Decimal(14,2)`). Our own unit prices are already 2dp so the
 * rounding is a no-op in practice, but the invariant belongs to the helper,
 * not to every caller.
 */
export function totalAmount(unitPrice: Prisma.Decimal, seats: number): Prisma.Decimal {
  return unitPrice.mul(seats).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}
