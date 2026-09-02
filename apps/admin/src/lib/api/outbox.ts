import type { AdminOutboxRetryInput, OutboxRow, Paged } from '@tourism/contract';
import type { OutboxQuery } from '@/lib/outbox-query';
import { api, withAdminAuth } from './client';

/**
 * Hai đường của vùng outbox (spec P4c §3-F7) — bọc mỏng `admin.outbox.list`
 * (đọc) và `retry` (ghi). KHÔNG nuốt lỗi ở đây: hai mã contract của retry
 * phải tới server action nguyên vẹn để `classifyRetryError` phân loại.
 */

/**
 * Một trang outbox (mới nhất trước — server đã orderBy `createdAt desc`).
 * Input là kết quả `parseOutboxSearchParams`, tức đã clamp/lọc xong.
 */
export async function fetchAdminOutbox(
  cookie: string,
  query: OutboxQuery,
): Promise<Paged<OutboxRow>> {
  return api.admin.outbox.list(query, { context: withAdminAuth(cookie) });
}

/**
 * Đưa hàng FAILED về hàng đợi. Timeout mặc định 10s là đủ: lệnh chỉ là một
 * UPDATE có guard, không gọi provider nào (khác refund/decide).
 */
export async function retryOutboxRow(
  cookie: string,
  input: AdminOutboxRetryInput,
): Promise<OutboxRow> {
  return api.admin.outbox.retry(input, { context: withAdminAuth(cookie) });
}
