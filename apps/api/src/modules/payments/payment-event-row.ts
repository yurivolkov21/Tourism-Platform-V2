import type { PaymentEventDetail, PaymentEventRow } from '@tourism/contract';
import type { PaymentEvent } from '../../generated/prisma/client.js';

/**
 * Row Prisma `payment_events` → `PaymentEventRow` / `PaymentEventDetail` của
 * contract (spec P4c §3-F8). THUẦN — unit test không cần DB. `bookingCode`
 * do service join (cột `bookingId` KHÔNG có FK — có thể trỏ tới booking
 * không còn, hoặc là id "chết" từ metadata provider) và truyền vào đây.
 *
 * ## Soi payload thật — kết luận redact (bài học bảo mật F7)
 *
 * Payload là `VerifiedEvent.raw` = event provider NGUYÊN VĂN (`stripe.gateway.ts`
 * `mapStripeEvent`, `paypal.gateway.ts` `mapPayPalEvent`, FakeGateway ghi
 * `{ fake, sessionId }`). Đã rà từng loại:
 *
 * - Stripe `checkout.session.*`: KHÔNG có credential. `url` là hosted checkout
 *   URL (KHÁC `url` của email PASSWORD_RESET bên outbox — không phải link mang
 *   token cho phép hành động thay người khác; và Stripe đặt null sau khi
 *   session completed/expired). `client_secret` của session chỉ có ở embedded
 *   mode (v2 dùng hosted) — dù vậy vẫn che theo tên.
 * - Stripe `payment_intent.payment_failed`: `data.object` là PaymentIntent,
 *   MANG `client_secret` (`pi_…_secret_…`) — Stripe ghi rõ "should not be
 *   stored, logged, or exposed to anyone other than the customer": ai cầm nó
 *   xác nhận được payment intent từ frontend. ĐÂY là thứ phải che.
 * - PayPal `PAYMENT.CAPTURE.*` / `CHECKOUT.ORDER.APPROVED`: `resource` +
 *   `links[].href` (URL API cần Bearer riêng, không phải secret). Không có
 *   credential; token OAuth không bao giờ nằm trong webhook.
 * - PII khách (`customer_details.email/name`, `payer`) HIỆN theo spec §2.3:
 *   admin đã thấy email ở bảng bookings; chỉ cấm chép vào log server.
 *
 * Nên: che theo TÊN khoá ở MỌI độ sâu (khác outbox chỉ che tầng ngoài —
 * payload provider lồng `data.object.*`), một tập tên credential thông dụng
 * để event/provider mới mang `client_secret`/`access_token` cũng tự được che
 * mà không phải nhớ thêm vào danh sách. Redact ở MAPPER (một chỗ, cả `byId`
 * đi qua) chứ không ở UI.
 */

/** Khoá payload có thể mang credential — che ở mọi độ sâu, mọi provider. */
export const SECRET_PAYLOAD_KEYS: ReadonlySet<string> = new Set([
  'client_secret',
  'secret',
  'access_token',
  'refresh_token',
  'api_key',
  'password',
  'token',
]);

export const REDACTED = '[redacted]';

/**
 * Che khoá bí mật đệ quy. Object mới được dựng thay vì sửa tại chỗ — payload
 * Prisma trả có thể được cache/đọc lại ở nơi khác.
 */
export function redactPayload(payload: PaymentEvent['payload']): PaymentEventDetail['payload'] {
  // Cùng một tập giá trị JSON, hai cách gõ: Prisma khai `JsonArray` là
  // interface kế thừa Array nên TS không khớp nó với union đệ quy `JSONType`
  // của `z.json()`. Cast là khớp DANH NGHĨA, không đổi giá trị.
  return redactValue(payload) as PaymentEventDetail['payload'];
}

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactValue);
  if (value === null || typeof value !== 'object') return value;
  const out: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) {
    out[key] = SECRET_PAYLOAD_KEYS.has(key) ? REDACTED : redactValue(child);
  }
  return out;
}

/** Phần row mà bảng cần — list SELECT bỏ `payload` nên nhận kiểu không có nó. */
export type PaymentEventListRow = Omit<PaymentEvent, 'payload'>;

export function toPaymentEventRow(
  row: PaymentEventListRow,
  bookingCode: string | null,
): PaymentEventRow {
  return {
    id: row.id,
    provider: row.provider,
    eventId: row.eventId,
    type: row.type,
    // `toFixed(2)`: gateway đã ghi 2 số lẻ, nhưng Decimal đọc lại có thể rụng
    // số 0 cuối ("500000") — contract hứa chuỗi tiền cùng dạng với bookings.
    amount: row.amount ? row.amount.toFixed(2) : null,
    currency: row.currency,
    bookingCode,
    receivedAt: row.receivedAt.toISOString(),
    processedAt: row.processedAt ? row.processedAt.toISOString() : null,
  };
}

export function toPaymentEventDetail(
  row: PaymentEvent,
  bookingCode: string | null,
): PaymentEventDetail {
  return { ...toPaymentEventRow(row, bookingCode), payload: redactPayload(row.payload) };
}
