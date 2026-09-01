import type {
  AdminBookingsStats,
  AdminCancellationsStats,
  AdminReviewsStats,
} from '@tourism/contract';
import { api, withAdminAuth } from './client';

/**
 * Ba đường đọc số liệu vùng (spec P4b §3-F5) — bọc mỏng `admin.stats.*`, cùng
 * nếp cookie-forward + `no-store` như các fetcher khác (`cache: 'no-store'` là
 * VÔ ĐIỀU KIỆN ở `client.ts`, back-office luôn đọc số tươi).
 *
 * `undefined` ở vị trí input là ĐÚNG chữ ký: ba procedure này không khai
 * `.input()` (cửa sổ 28 ngày là hằng của sản phẩm, không phải tham số) — cùng
 * cách gọi `catalog.destinations.list` bên web.
 *
 * KHÔNG nuốt lỗi ở đây: trang gọi ba fetcher trong một `Promise.all`, nên một
 * endpoint stats hỏng sẽ rơi vào `app/error.tsx` y như khi list hỏng. Cố ý —
 * "vẫn hiện bảng, âm thầm giấu hàng card" nghĩa là một endpoint chết có thể
 * sống nhiều tuần mà không ai biết.
 */

export async function fetchAdminBookingsStats(cookie: string): Promise<AdminBookingsStats> {
  return api.admin.stats.bookings(undefined, { context: withAdminAuth(cookie) });
}

export async function fetchAdminCancellationsStats(
  cookie: string,
): Promise<AdminCancellationsStats> {
  return api.admin.stats.cancellations(undefined, { context: withAdminAuth(cookie) });
}

export async function fetchAdminReviewsStats(cookie: string): Promise<AdminReviewsStats> {
  return api.admin.stats.reviews(undefined, { context: withAdminAuth(cookie) });
}
