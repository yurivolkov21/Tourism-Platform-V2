import { isDefinedError, safe } from '@orpc/client';
import type { Booking, Paged } from '@tourism/contract';
import { cache } from 'react';
import { api, withAuthHeaders } from './client';

/** `limit` mặc định của `BookingsListQuerySchema` (khớp server) — dùng cho
 *  một "trang" `?page=` trên `/account/bookings`. */
export const BOOKINGS_PAGE_SIZE = 12;

/** Trần `limit` của `BookingsListQuerySchema` — Zod chặn cứng phía server,
 *  client không được vượt. */
export const BOOKINGS_MAX_LIMIT = 50;

/**
 * Booking của chính user, mới nhất trước (server đã `orderBy createdAt desc`
 * — KHÔNG cần sort lại phía web như mock cũ). Gọi từ `/account/bookings`
 * (`?page=` quyết định `limit`, đọc cả `.total` để quyết định có hiện
 * "Load more" hay không — xem trang đó).
 */
export async function fetchMyBookings(cookie: string, limit: number): Promise<Paged<Booking>> {
  return api.bookings.mine({ page: 1, limit }, { context: withAuthHeaders(cookie) });
}

/**
 * Booking của chính user theo code (trang chi tiết). `NOT_FOUND` (owner-or-404
 * — mã lạ HOẶC của người khác đều rơi vào đây, không phân biệt để khỏi lộ sự
 * tồn tại) map về `null`, trang gọi `notFound()`; lỗi khác ném lại cho error
 * boundary (khớp khuôn `fetchTourDetail` ở `tours.ts`).
 *
 * Bọc React `cache()` — `generateMetadata` VÀ thân trang cùng gọi hàm này với
 * CÙNG `(cookie, code)` trong một request, dedupe còn lại đúng một fetch
 * (cùng lý do `fetchTourDetail`).
 */
export const fetchBookingByCode = cache(
  async (cookie: string, code: string): Promise<Booking | null> => {
    const [error, data] = await safe(
      api.bookings.byCode({ code }, { context: withAuthHeaders(cookie) }),
    );
    if (error) {
      if (isDefinedError(error) && error.code === 'NOT_FOUND') return null;
      throw error;
    }
    return data;
  },
);
