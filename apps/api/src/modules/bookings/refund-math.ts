import { Prisma } from '../../generated/prisma/client.js';

/**
 * Refund ledger math thuần (spec P2 §3/§4 invariant #5, W3) — logic classify
 * port từ Nexora `refund-amount.ts` và MỞ RỘNG cho accumulation: Nexora phân
 * loại request theo mỗi `totalAmount` (schema của nó chỉ có một cột
 * `refunded_amount` nên partial thứ hai là bất khả); Refund ledger của v2 cho
 * partial cộng dồn, nên mọi rule ở đây chạy trên phần REMAINDER
 * (`total - alreadyRefunded`), không phải trên total.
 *
 * Toàn bộ math trên `Prisma.Decimal`, HALF_UP về 2dp — money không bao giờ đi
 * qua float (quy ước pricing.ts). Tham số `amount?: number` của Nexora được
 * nâng lên decimal STRING cũng vì lý do đó.
 *
 * Currency (invariant #6 — no FX): `classifyRefundAmount` cố ý KHÔNG nhận
 * tham số currency nào. Input `amount` của contract không mang currency
 * (currency của booking là ngầm định), service phát gateway refund theo
 * `booking.currency` và lưu Refund row với đúng currency đó — một mismatch
 * currency refund/booking là bất khả biểu diễn theo thiết kế, nên không hề tồn
 * tại error CURRENCY_MISMATCH trên đường input.
 */

/** Requested + SUM(refunds) sẽ vượt total của booking (invariant #5 → 422). */
export class RefundOverTotalError extends Error {
  constructor(remainder: Prisma.Decimal) {
    super(`Refund amount exceeds the refundable remainder (${remainder.toFixed(2)})`);
  }
}

/** Requested amount ≤ 0 sau khi làm tròn 2dp (regex contract cho phép "0.00"). */
export class RefundZeroOrNegativeError extends Error {
  constructor() {
    super('Refund amount must be greater than zero');
  }
}

/** Ledger đã cộng đủ total của booking — không còn gì để refund. */
export class RefundNothingLeftError extends Error {
  constructor() {
    super('Booking is already fully refunded');
  }
}

export interface ClassifyRefundInput {
  /** Amount yêu cầu dạng decimal string; null/absent → refund phần remainder. */
  requested?: string | null;
  /** Booking.totalAmount. */
  total: Prisma.Decimal;
  /** SUM(refunds.amount) đã ledger cho booking. */
  alreadyRefunded: Prisma.Decimal;
}

/**
 * Classification kiểu discriminated: `full` nghĩa là refund NÀY settle luôn
 * booking (alreadyRefunded + amount = total → status REFUNDED), `partial` là
 * vẫn còn nợ một remainder (→ PARTIALLY_REFUNDED). `amount` là Decimal 2dp
 * chính xác để gửi sang gateway và ghi ledger.
 */
export type RefundClassification = {
  kind: 'full' | 'partial';
  amount: Prisma.Decimal;
};

export function classifyRefundAmount(input: ClassifyRefundInput): RefundClassification {
  const remainder = input.total.sub(input.alreadyRefunded);
  // NOTHING_LEFT trước: trên một booking đã settle thì request là invalid bất
  // kể amount nói gì (đồng thời phòng thủ luôn cho ledger bị over-refund).
  if (remainder.lessThanOrEqualTo(0)) throw new RefundNothingLeftError();

  if (input.requested == null) {
    // Bỏ trống amount = "refund phần còn lại" — theo định nghĩa là settle.
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
 * Projection Booking.status từ ledger (spec §3: ledger là source of truth,
 * status là projection được lưu): SUM(refunds) < total → PARTIALLY_REFUNDED;
 * = total → REFUNDED. `>=` là cố ý — một ledger bị over-refund (bất khả qua
 * {@link classifyRefundAmount}) vẫn phải project về terminal state, không bao
 * giờ nói dối là "partially".
 */
export function deriveStatusAfterRefund(
  totalRefunded: Prisma.Decimal,
  totalAmount: Prisma.Decimal,
): 'PARTIALLY_REFUNDED' | 'REFUNDED' {
  return totalRefunded.greaterThanOrEqualTo(totalAmount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
}
