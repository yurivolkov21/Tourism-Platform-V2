import { Prisma } from '../../generated/prisma/client.js';

/**
 * Pure refund ledger math (spec P2 §3/§4 invariant #5, W3) — the classify
 * logic ported from Nexora `refund-amount.ts` and EXTENDED for accumulation:
 * Nexora classified a request against `totalAmount` alone (its schema had one
 * `refunded_amount` column, so a second partial was impossible); v2's Refund
 * ledger makes partials add up, so every rule here runs against the REMAINDER
 * (`total - alreadyRefunded`), not the total.
 *
 * All math on `Prisma.Decimal`, HALF_UP to 2dp — money never transits floats
 * (pricing.ts convention). Nexora's `amount?: number` parameter is upgraded to
 * a decimal STRING for the same reason.
 *
 * Currency (invariant #6 — no FX): `classifyRefundAmount` deliberately takes
 * NO currency arguments. The contract's `amount` input is currency-less (the
 * booking's currency is implied), the service issues the gateway refund in
 * `booking.currency` and stores the Refund row with that same currency — a
 * refund/booking currency mismatch is unrepresentable by construction, so no
 * CURRENCY_MISMATCH error exists on the input path.
 */

/** Requested + SUM(refunds) would exceed the booking total (invariant #5 → 422). */
export class RefundOverTotalError extends Error {
  constructor(remainder: Prisma.Decimal) {
    super(`Refund amount exceeds the refundable remainder (${remainder.toFixed(2)})`);
  }
}

/** Requested amount is ≤ 0 after 2dp rounding (contract regex admits "0.00"). */
export class RefundZeroOrNegativeError extends Error {
  constructor() {
    super('Refund amount must be greater than zero');
  }
}

/** The ledger already sums to the booking total — nothing left to refund. */
export class RefundNothingLeftError extends Error {
  constructor() {
    super('Booking is already fully refunded');
  }
}

export interface ClassifyRefundInput {
  /** Requested amount as a decimal string; null/absent → refund the remainder. */
  requested?: string | null;
  /** Booking.totalAmount. */
  total: Prisma.Decimal;
  /** SUM(refunds.amount) already ledgered for the booking. */
  alreadyRefunded: Prisma.Decimal;
}

/**
 * Discriminated classification: `full` means THIS refund settles the booking
 * (alreadyRefunded + amount = total → status REFUNDED), `partial` that a
 * remainder is still owed (→ PARTIALLY_REFUNDED). `amount` is the exact 2dp
 * Decimal to send to the gateway and ledger.
 */
export type RefundClassification = {
  kind: 'full' | 'partial';
  amount: Prisma.Decimal;
};

export function classifyRefundAmount(input: ClassifyRefundInput): RefundClassification {
  const remainder = input.total.sub(input.alreadyRefunded);
  // NOTHING_LEFT first: on a settled booking the request is invalid whatever
  // the amount says (also defensively covers an over-refunded ledger).
  if (remainder.lessThanOrEqualTo(0)) throw new RefundNothingLeftError();

  if (input.requested == null) {
    // Omitted amount = "refund whatever is left" — by definition it settles.
    return { kind: 'full', amount: remainder };
  }

  const amount = new Prisma.Decimal(input.requested).toDecimalPlaces(
    2,
    Prisma.Decimal.ROUND_HALF_UP,
  );
  if (amount.lessThanOrEqualTo(0)) throw new RefundZeroOrNegativeError();
  if (amount.greaterThan(remainder)) throw new RefundOverTotalError(remainder);

  return { kind: amount.equals(remainder) ? 'full' : 'partial', amount };
}

/**
 * Booking.status projection from the ledger (spec §3: the ledger is the
 * source of truth, status a stored projection): SUM(refunds) < total →
 * PARTIALLY_REFUNDED; = total → REFUNDED. `>=` is deliberate — an
 * over-refunded ledger (impossible via {@link classifyRefundAmount}) must
 * still project the terminal state, never a lying "partially".
 */
export function deriveStatusAfterRefund(
  totalRefunded: Prisma.Decimal,
  totalAmount: Prisma.Decimal,
): 'PARTIALLY_REFUNDED' | 'REFUNDED' {
  return totalRefunded.greaterThanOrEqualTo(totalAmount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
}
