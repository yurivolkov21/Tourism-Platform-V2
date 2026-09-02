'use server';

import {
  type AdminPaymentEventByIdInput,
  AdminPaymentEventByIdInputSchema,
} from '@tourism/contract';
import { cookies } from 'next/headers';
import { fetchAdminPaymentEvent } from '@/lib/api/payment-events';
import { classifyLoadError, type PaymentEventLoadResult } from '@/lib/payment-events-detail';

/**
 * Đường ĐỌC payload cho drawer `/payment-events` (spec P4c §3-F8) — server
 * action chứ không phải route handler (quyết định tự chọn F8):
 *
 * - Client oRPC của admin là đường server-only (đọc cookie phiên qua
 *   `next/headers`), được gọi từ một client component khi drawer mở.
 * - Route handler phải TỰ gác quyền (`decideAdminAccess`, như
 *   `bookings/export`) — ở đây không có file để trả nên không có lý do trả
 *   giá đó; action đi qua guard của API như mọi lời gọi khác.
 * - Quyền KHÔNG kiểm ở đây: gác ở `AuthGuard` + `@Roles(ADMIN)` của API.
 * - Input re-parse bằng CHÍNH schema contract: hỏng thì `INVALID_INPUT`.
 * - `ORPCError` không sống sót qua ranh giới action — phân loại tại đây.
 *
 * Payload đã redact credential ở API; ở đây KHÔNG log nó (spec §2.3).
 */
export async function getPaymentEventAction(
  input: AdminPaymentEventByIdInput,
): Promise<PaymentEventLoadResult> {
  const parsed = AdminPaymentEventByIdInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  try {
    const event = await fetchAdminPaymentEvent(cookie, parsed.data);
    return { ok: true, event };
  } catch (error) {
    return { ok: false, code: classifyLoadError(error) };
  }
}
