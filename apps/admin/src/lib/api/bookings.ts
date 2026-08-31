import { isDefinedError, safe } from '@orpc/client';
import type { AdminBookingDetail, Booking, Paged } from '@tourism/contract';
import { cache } from 'react';
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
 * `NOT_FOUND` → `null` để trang gọi `notFound()`; lỗi khác ném lại cho error
 * boundary (cùng khuôn `fetchBookingByCode` của web).
 *
 * Bọc React `cache()`: `generateMetadata` và thân trang cùng gọi với cùng
 * `(cookie, code)` trong một request — dedupe còn đúng một fetch.
 */
export const fetchAdminBookingByCode = cache(
  async (cookie: string, code: string): Promise<AdminBookingDetail | null> => {
    const [error, data] = await safe(
      api.admin.bookings.byCode({ code }, { context: withAdminAuth(cookie) }),
    );
    if (error) {
      if (isDefinedError(error) && error.code === 'NOT_FOUND') return null;
      throw error;
    }
    return data;
  },
);
