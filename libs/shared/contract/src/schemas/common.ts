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

/**
 * Phân trang của MỌI list ADMIN (`page` + `limit`, trần 100, mặc định 20) —
 * một bản duy nhất (vòng vá review F7: bookings/cancellations/outbox từng
 * khai inline bốn lần, và `apps/admin/src/lib/table-query.ts` giữ hằng gương
 * `ADMIN_PAGE_SIZE`/`PAGE_SIZE_MAX` phải khớp tay). Khác `PageQuerySchema`
 * (đường khách, field tên `pageSize`) — hai tên field là NỢ cũ, đừng gộp mù:
 * đổi tên field là đổi URL đang chạy.
 *
 * Dùng `.extend(...)` để nối filter của vùng — Zod 4 giữ `.shape` nên
 * `ZodSmartCoercionPlugin` bên API vẫn ép được "2" → 2 cho page/limit.
 */
export const AdminPageQuerySchema = z.object({
  page: z.int().min(1).default(1),
  limit: z.int().min(1).max(100).default(20),
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

/**
 * Chuyển từ `bookings.ts` sang đây 04/09: từ khi `/reviews` cũng lọc theo
 * khoảng ngày (ADR-0028 §AMEND 2), BA vùng query dùng chung kiểu này —
 * nó không còn là khái niệm của riêng bookings, và để nguyên chỗ cũ thì
 * schema review phải import từ schema booking, một cạnh phụ thuộc không có
 * lý do nghiệp vụ nào.
 */
/**
 * Ngày lịch `YYYY-MM-DD` cho bộ lọc admin — `z.iso.date()` (loại cả ngày
 * không tồn tại kiểu `2026-02-30`) CỘNG trần năm 1900–2099 (vòng vá review
 * F6): API cộng `to` thêm một ngày để dựng biên nửa-mở, và `9999-12-31 + 1d`
 * là một `Date` năm 10000 mà `toISOString()` in thành `+010000-…` — thứ rơi
 * thẳng xuống driver Postgres không qua schema nào chặn. Cùng trần với
 * `ReportMonthSchema` bên `reports.ts`; so sánh chuỗi dùng được vì ISO date
 * sắp thứ tự từ điển đúng bằng thứ tự thời gian.
 *
 * EXPORT để admin (`bookings-query.ts`) dùng ĐÚNG bản này — không có bản
 * thứ hai để trôi lệch: cái gì lọt qua client thì server cũng nhận.
 */
export const CalendarDateSchema = z.iso
  .date()
  .refine((value) => value >= '1900-01-01' && value <= '2099-12-31', {
    message: 'date must be between 1900 and 2099',
  });
