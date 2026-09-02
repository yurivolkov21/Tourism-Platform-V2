import type {
  AdminPaymentEventByIdInput,
  Paged,
  PaymentEventDetail,
  PaymentEventRow,
} from '@tourism/contract';
import type { PaymentEventsQuery } from '@/lib/payment-events-query';
import { api, withAdminAuth } from './client';

/**
 * Hai đường ĐỌC của vùng payment events (spec P4c §3-F8) — bọc mỏng
 * `admin.paymentEvents.list` và `byId`. KHÔNG nuốt lỗi ở đây: `NOT_FOUND`
 * của `byId` phải tới server action nguyên vẹn để được phân loại.
 */

/**
 * Một trang event (mới nhất trước — server đã orderBy `receivedAt desc`),
 * KHÔNG mang payload. Input là kết quả `parsePaymentEventsSearchParams`,
 * tức đã clamp/lọc xong.
 */
export async function fetchAdminPaymentEvents(
  cookie: string,
  query: PaymentEventsQuery,
): Promise<Paged<PaymentEventRow>> {
  return api.admin.paymentEvents.list(query, { context: withAdminAuth(cookie) });
}

/** Một event kèm payload provider (đã redact credential ở API) — drawer gọi khi mở. */
export async function fetchAdminPaymentEvent(
  cookie: string,
  input: AdminPaymentEventByIdInput,
): Promise<PaymentEventDetail> {
  return api.admin.paymentEvents.byId(input, { context: withAdminAuth(cookie) });
}
