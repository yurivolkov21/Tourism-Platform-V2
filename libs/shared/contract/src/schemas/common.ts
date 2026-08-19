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

/**
 * Email hợp lệ, trần 200 ký tự — MỘT định nghĩa cho mọi form (enquiry,
 * newsletter, booking) và cho validate client của cụm auth (Better Auth tự
 * kiểm bằng `z.email()` phía server, ta soi gương ở client để báo lỗi
 * "email không hợp lệ" trước khi round-trip).
 */
export const EmailSchema = z.email().max(200);

/**
 * Mật khẩu — soi gương ĐÚNG mặc định của Better Auth 1.6 (`minPasswordLength`
 * 8 / `maxPasswordLength` 128, `apps/api/src/auth/auth.config.ts` không ghi
 * đè). Server vẫn là chốt cuối; client dùng để báo "quá ngắn" tại ô nhập thay
 * vì ăn 400 `PASSWORD_TOO_SHORT` rồi hiện lỗi chung chung.
 */
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const PasswordSchema = z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH);
