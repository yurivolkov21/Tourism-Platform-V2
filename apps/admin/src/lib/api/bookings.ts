import { isDefinedError, safe } from '@orpc/client';
import {
  type AdminBookingDetail,
  type AdminRefundInput,
  type AdminRefundResult,
  type Booking,
  BookingCodeSchema,
  type Paged,
} from '@tourism/contract';
import type { BookingsQuery } from '@/lib/bookings-query';
import { api, withAdminAuth } from './client';

/**
 * Ba đường của vùng bookings — bọc mỏng `admin.bookings.list` / `byCode`
 * (đọc, F1) và `refund` (ghi, F2). P4b KHÔNG thêm endpoint nào.
 */

/**
 * Một trang booking (TẤT CẢ khách, mới nhất trước — server đã orderBy). Input
 * là kết quả `parseBookingsSearchParams`, tức đã clamp/lọc xong.
 */
export async function fetchAdminBookings(
  cookie: string,
  query: BookingsQuery,
): Promise<Paged<Booking>> {
  return api.admin.bookings.list(query, { context: withAdminAuth(cookie) });
}

/**
 * Chi tiết một booking theo code, kèm toàn bộ lịch sử cancellation (D1-B).
 * `null` = không có booking này để trang gọi `notFound()`; lỗi khác ném lại
 * cho error boundary (cùng khuôn `fetchBookingByCode` của web). KHÔNG bọc
 * React `cache()`: chỉ có một call site mỗi request (`generateMetadata` chỉ
 * đọc `params`, không fetch) — bản đầu F1 bọc với lời giải thích sai, gỡ ở
 * review 31/08.
 *
 * `code` đến thẳng từ URL nên soi định dạng TRƯỚC khi gọi API: chuỗi không
 * khớp `BK-XXXXXXXX` sẽ bị contract chặn thành BAD_REQUEST (không phải
 * defined error `NOT_FOUND`) và nổ ra trang 500 — với người dùng thì
 * "/bookings/foo" là 404, không phải lỗi hệ thống.
 */
export async function fetchAdminBookingByCode(
  cookie: string,
  code: string,
): Promise<AdminBookingDetail | null> {
  if (!BookingCodeSchema.safeParse(code).success) return null;
  const [error, data] = await safe(
    api.admin.bookings.byCode({ code }, { context: withAdminAuth(cookie) }),
  );
  if (error) {
    if (isDefinedError(error) && error.code === 'NOT_FOUND') return null;
    throw error;
  }
  return data;
}

/**
 * Refund (một phần) do admin phát — money-path (spec P4b §3-F2, ledger
 * ADR-0009). Bọc mỏng đúng như hai hàm đọc: KHÔNG nuốt lỗi ở đây.
 *
 * Sáu mã lỗi của contract (NOT_FOUND + năm mã 422/502) phải tới được UI
 * nguyên vẹn để mỗi mã có một câu riêng (bất biến spec §2.4), nên hàm này để
 * `ORPCError` ném thẳng lên; server action mới là chỗ phân loại
 * (`classifyRefundError`) — vì đó là biên cuối cùng còn giữ được kiểu lỗi.
 */
export async function refundAdminBooking(
  cookie: string,
  input: AdminRefundInput,
): Promise<AdminRefundResult> {
  // Trần 30s RIÊNG cho lệnh ghi tiền (mặc định link là 10s cho đường đọc):
  // refund gọi provider BÊN TRONG request; abort trong lúc API đã commit
  // ledger là kịch bản mở màn refund đúp (review F2 31/08). 30s ôm được p99
  // của provider; quá nữa thì đúng là không rõ — GENERIC xử theo lối
  // "đóng dialog + refresh" phía panel.
  return api.admin.bookings.refund(input, {
    context: { cookie, signal: AbortSignal.timeout(30_000) },
  });
}
