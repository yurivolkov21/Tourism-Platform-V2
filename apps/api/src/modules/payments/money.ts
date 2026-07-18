import { Prisma } from '../../generated/prisma/client.js';

/**
 * Minor-units money math for the payment gateways — port of Nexora's
 * `payments/money.ts` (`toStripeMinorUnits` / `toPayPalAmount`) behind the W5
 * gateway boundary, upgraded to Decimal-in/Decimal-out with explicit HALF_UP
 * rounding (Nexora rounded via `Math.round(scaled.toNumber())`, which detours
 * through IEEE754; v2 stays in Decimal until the final integer).
 *
 * Boundary conventions (gateway.ts): money crosses the PaymentGateway interface
 * as 2dp decimal STRINGS ("117.00"); each provider impl converts here.
 */

/**
 * ISO-4217 zero-decimal currencies (Stripe's list, same set Nexora shipped):
 * no minor unit exists, so provider amounts are the major value as-is (×1, not
 * ×100). Includes VND (our VN pricing currency) and JPY/KRW.
 */
export const ZERO_DECIMAL_CURRENCIES: ReadonlySet<string> = new Set([
  'BIF',
  'CLP',
  'DJF',
  'GNF',
  'JPY',
  'KMF',
  'KRW',
  'MGA',
  'PYG',
  'RWF',
  'UGX',
  'VND',
  'VUV',
  'XAF',
  'XOF',
  'XPF',
]);

/** True when `currency` (any case) has no minor unit. */
export function isZeroDecimalCurrency(currency: string): boolean {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase());
}

/**
 * Decimal amount (string form) → the integer smallest-unit value a provider
 * expects (cents for USD, whole units for VND/JPY). HALF_UP on sub-minor
 * precision; Decimal end-to-end so `"19.99"` can never become `1998.99…`.
 */
export function toMinorUnits(amount: string | Prisma.Decimal, currency: string): number {
  const decimal = new Prisma.Decimal(amount);
  const scaled = isZeroDecimalCurrency(currency) ? decimal : decimal.mul(100);
  return scaled.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Provider smallest-unit integer → the gateway-boundary 2dp decimal string
 * (`11700, USD → "117.00"`; `500000, VND → "500000.00"`). Used when mapping
 * verified webhook amounts onto {@link VerifiedEvent.amount} — ALWAYS 2dp, the
 * same shape `Booking.totalAmount.toFixed(2)` produces, so forensics compare
 * string-equal.
 */
export function fromMinorUnits(minor: number | string, currency: string): string {
  const decimal = new Prisma.Decimal(minor);
  const major = isZeroDecimalCurrency(currency) ? decimal : decimal.div(100);
  return major.toFixed(2);
}

/**
 * Decimal amount (string form) → the major-units `amount.value` STRING with
 * the currency's exact precision (`"117.00"` USD, `"500000"` VND) — PayPal
 * rejects a value whose decimals don't match the currency (Nexora
 * `toPayPalAmount`). HALF_UP when the input is finer than the currency.
 */
export function toAmountValue(amount: string | Prisma.Decimal, currency: string): string {
  const places = isZeroDecimalCurrency(currency) ? 0 : 2;
  return new Prisma.Decimal(amount)
    .toDecimalPlaces(places, Prisma.Decimal.ROUND_HALF_UP)
    .toFixed(places);
}
