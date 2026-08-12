import { z } from 'zod';

/**
 * Schema query dùng chung cho MỌI list endpoint. Nexora có 3 biến thể
 * `Paginated*` gần giống nhau ở 3 module khác nhau — gom về một chỗ để client
 * chỉ phải học một hình dạng.
 */
export const PageQuerySchema = z.object({
  page: z.int().min(1).default(1),
  pageSize: z.int().min(1).max(100).default(20),
});

/** Ô tìm kiếm tự do; trim sẵn để service khỏi phải nhớ. */
export const SearchQuerySchema = z.object({
  search: z.string().trim().min(1).max(160).optional(),
});

/**
 * Sinh schema sort với danh sách key hợp lệ đóng — client gửi key lạ thì
 * Zod chặn ngay, service không bao giờ nhận `orderBy` không mong đợi.
 * Key đầu tiên là mặc định.
 */
export function sortQuerySchema<const K extends readonly [string, ...string[]]>(keys: K) {
  return z.object({
    sortBy: z.enum(keys).default(keys[0]),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  });
}

export type PageQuery = z.infer<typeof PageQuerySchema>;

/**
 * `BK-` + 8 ký tự base36 in hoa (xem apps/api bookings/booking-code.ts).
 * Đặt ở `common.ts` (không phải `bookings.ts`) vì `schemas/media.ts` cũng cần
 * schema này (REVIEW_PHOTO phải khai booking) — để trong `bookings.ts` sẽ tạo
 * import vòng `bookings.ts ↔ media.ts` (bookings đã import `MediaItemSchema`
 * từ `media.ts` cho `tourImage`). `bookings.ts` re-export lại từ đây để mọi
 * chỗ import `BookingCodeSchema` từ `'./bookings.js'` không phải đổi gì.
 */
export const BookingCodeSchema = z.string().regex(/^BK-[A-Z0-9]{8}$/, 'expected a booking code');
