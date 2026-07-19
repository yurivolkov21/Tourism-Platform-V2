import { Prisma } from '../../generated/prisma/client.js';

/**
 * Money math theo minor units cho các payment gateway — port từ
 * `payments/money.ts` của Nexora (`toStripeMinorUnits` / `toPayPalAmount`) đặt
 * sau gateway boundary W5, nâng cấp thành Decimal-vào/Decimal-ra với rounding
 * HALF_UP tường minh (Nexora làm tròn qua `Math.round(scaled.toNumber())`, vòng
 * qua IEEE754; v2 giữ nguyên Decimal cho tới số nguyên cuối cùng).
 *
 * Quy ước ở boundary (gateway.ts): tiền đi qua interface PaymentGateway dưới
 * dạng decimal STRING 2 chữ số ("117.00"); mỗi provider impl tự convert tại đây.
 */

/**
 * Các currency zero-decimal theo ISO-4217 (danh sách của Stripe, đúng bộ Nexora
 * đã ship): không có minor unit nên số tiền gửi provider chính là giá trị major
 * để nguyên (×1, không ×100). Gồm VND (currency định giá VN của mình) và JPY/KRW.
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

/** True khi `currency` (không phân biệt hoa thường) không có minor unit. */
export function isZeroDecimalCurrency(currency: string): boolean {
  return ZERO_DECIMAL_CURRENCIES.has(currency.toUpperCase());
}

/**
 * Số tiền Decimal (dạng string) → giá trị số nguyên đơn vị nhỏ nhất mà provider
 * mong đợi (cent cho USD, đơn vị nguyên cho VND/JPY). HALF_UP ở phần lẻ dưới
 * minor unit; Decimal xuyên suốt để `"19.99"` không bao giờ thành `1998.99…`.
 */
export function toMinorUnits(amount: string | Prisma.Decimal, currency: string): number {
  const decimal = new Prisma.Decimal(amount);
  const scaled = isZeroDecimalCurrency(currency) ? decimal : decimal.mul(100);
  return scaled.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Số nguyên đơn vị nhỏ nhất của provider → decimal string 2 chữ số ở gateway
 * boundary (`11700, USD → "117.00"`; `500000, VND → "500000.00"`). Dùng khi map
 * amount đã verify từ webhook vào {@link VerifiedEvent.amount} — LUÔN 2 chữ số,
 * cùng shape mà `Booking.totalAmount.toFixed(2)` sinh ra, để việc đối soát so
 * sánh string-equal.
 */
export function fromMinorUnits(minor: number | string, currency: string): string {
  const decimal = new Prisma.Decimal(minor);
  const major = isZeroDecimalCurrency(currency) ? decimal : decimal.div(100);
  return major.toFixed(2);
}

/**
 * Số tiền Decimal (dạng string) → STRING `amount.value` theo major units với
 * đúng precision của currency (`"117.00"` USD, `"500000"` VND) — PayPal từ chối
 * giá trị có số chữ số thập phân không khớp currency (Nexora `toPayPalAmount`).
 * HALF_UP khi input mịn hơn precision của currency.
 */
export function toAmountValue(amount: string | Prisma.Decimal, currency: string): string {
  const places = isZeroDecimalCurrency(currency) ? 0 : 2;
  return new Prisma.Decimal(amount)
    .toDecimalPlaces(places, Prisma.Decimal.ROUND_HALF_UP)
    .toFixed(places);
}
