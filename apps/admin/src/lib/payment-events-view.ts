import type { PaymentEventRow, PaymentProviderValue } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { formatAmount, formatDateTime } from './bookings-view';

/**
 * Mapper hiển thị bảng `/payment-events` (spec P4c §3-F8) — THUẦN, ngoài
 * React nên test được từng nhánh; bảng và drawer chỉ render VM có sẵn.
 *
 * Tiền và ngày giờ mượn `bookings-view` (đủ hai số lẻ, in UTC) — một luật
 * đọc tiền/thời gian cho cả back-office.
 */

const t = messages.admin.paymentEvents;

/**
 * Cột Amount. Quyết định tự chọn F8 cho ca `currency` null: gateway ghi CẢ
 * HAI hoặc KHÔNG (`stripe.gateway.ts`/`paypal.gateway.ts`), nhưng contract
 * khai hai field nullable độc lập — nếu một ngày lệch, in chuỗi thập phân
 * THÔ chứ không dán một ký hiệu đoán mò ("$" lên tiền VND là nói dối). Không
 * có tiền thì null: bảng in dấu gạch, VM không bịa "0.00".
 */
export function formatEventAmount(amount: string | null, currency: string | null): string | null {
  if (amount === null) return null;
  return currency ? formatAmount(amount, currency) : amount;
}

/**
 * Nhãn type: bốn type gateway biết có nhãn i18n; cột DB là chuỗi tự do nên
 * type lạ in NGUYÊN chuỗi — "payment.chargeback" nói nhiều hơn "Unknown".
 */
function typeLabel(type: string): string {
  return (t.type as Record<string, string>)[type] ?? type;
}

/** Một hàng của bảng `/payment-events` — cũng là phần "field" của drawer. */
export interface PaymentEventRowVM {
  id: string;
  provider: PaymentProviderValue;
  providerLabel: string;
  eventId: string;
  type: string;
  typeLabel: string;
  /** null = event không mang tiền; bảng in chữ thay thế. */
  amount: string | null;
  bookingCode: string | null;
  /** Link chéo sang `/bookings/[code]` — null khi không gắn booking. */
  bookingHref: string | null;
  received: string;
  processed: string | null;
  /** `processedAt` null — đã nhận, handler chưa xong (badge + tooltip). */
  unprocessed: boolean;
}

/** Row của contract → hàng bảng đã format sẵn (server component gọi). */
export function toPaymentEventRowVM(row: PaymentEventRow): PaymentEventRowVM {
  return {
    id: row.id,
    provider: row.provider,
    providerLabel: t.provider[row.provider],
    eventId: row.eventId,
    type: row.type,
    typeLabel: typeLabel(row.type),
    amount: formatEventAmount(row.amount, row.currency),
    bookingCode: row.bookingCode,
    bookingHref: row.bookingCode ? `/bookings/${row.bookingCode}` : null,
    received: formatDateTime(row.receivedAt),
    processed: row.processedAt ? formatDateTime(row.processedAt) : null,
    unprocessed: row.processedAt === null,
  };
}
