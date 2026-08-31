import { isDefinedError, safe } from '@orpc/client';
import {
  type AdminBookingDetail,
  type Booking,
  BookingCodeSchema,
  type Paged,
} from '@tourism/contract';
import type { BookingsQuery } from '@/lib/bookings-query';
import { api, withAdminAuth } from './client';

/**
 * Hai đường đọc của vùng bookings (spec P4b §3-F1) — bọc mỏng
 * `admin.bookings.list` / `byCode`. P4b KHÔNG thêm endpoint nào; refund (F2)
 * sẽ nối vào chính module này.
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
