import type {
  AdminCancellationRequest,
  DecideCancellationInput,
  DecideCancellationResult,
  Paged,
} from '@tourism/contract';
import type { CancellationsQuery } from '@/lib/cancellations-query';
import { api, withAdminAuth } from './client';

/**
 * Hai đường của vùng cancellations (spec P4b §3-F3) — bọc mỏng
 * `admin.cancellations.list` (đọc) và `decide` (ghi). P4b F1–F4 KHÔNG thêm
 * endpoint nào.
 */

/**
 * Một trang request (mới nhất trước — server đã orderBy `createdAt desc`).
 * Input là kết quả `parseCancellationsSearchParams`, tức đã clamp/lọc xong.
 */
export async function fetchAdminCancellations(
  cookie: string,
  query: CancellationsQuery,
): Promise<Paged<AdminCancellationRequest>> {
  return api.admin.cancellations.list(query, { context: withAdminAuth(cookie) });
}

/**
 * Phán quyết của admin — money-path ở nhánh approve (refund phần còn lại +
 * booking CANCELLED + nhả ghế). Bọc mỏng đúng như đường đọc: KHÔNG nuốt lỗi
 * ở đây — bốn mã contract phải tới được UI nguyên vẹn để mỗi mã có một câu
 * riêng (bất biến §2.4); server action mới là chỗ phân loại
 * (`classifyDecideError`), vì đó là biên cuối cùng còn giữ được kiểu lỗi.
 */
export async function decideCancellation(
  cookie: string,
  input: DecideCancellationInput,
): Promise<DecideCancellationResult> {
  // Trần 30s RIÊNG cho lệnh này, cùng lý do như `refundAdminBooking`: nhánh
  // approve gọi provider BÊN TRONG request (và giữ advisory lock suốt
  // read→gateway→ledger), nên abort sớm trong lúc API đã commit là hạt giống
  // refund đúp. Quá 30s thì đúng là không rõ — GENERIC, và dialog xử theo
  // lối "đóng + refresh".
  return api.admin.cancellations.decide(input, {
    context: { cookie, signal: AbortSignal.timeout(30_000) },
  });
}
