import type {
  AdminTourRow,
  AdminTourSetPublishedInput,
  AdminTourSetPublishedResult,
  Paged,
  TourCategory,
} from '@tourism/contract';
import type { ToursQuery } from '@/lib/tours-query';
import { api, withAdminAuth } from './client';

/**
 * Ba đường của vùng tours (spec P4e-1 §3-F11) — bọc mỏng `admin.tours.*` cộng
 * một đường đọc công khai. KHÔNG nuốt lỗi ở đây: mã contract phải tới nơi gọi
 * nguyên vẹn (server action đổi chúng thành một mã UI).
 */

/**
 * Một trang tour, kèm số chuyến còn mở trong khoảng lọc. Input là kết quả
 * `parseToursSearchParams`, tức đã clamp.
 *
 * KHÔNG cache: catalogue đổi ngay dưới tay admin (chính công tắc trên bảng
 * này), và `router.refresh()` sau mỗi lần bấm phải kéo về sự thật mới.
 */
export async function fetchAdminTours(
  cookie: string,
  query: ToursQuery,
): Promise<Paged<AdminTourRow>> {
  return api.admin.tours.list(query, { context: withAdminAuth(cookie) });
}

/**
 * Danh mục cho menu lọc — đường CÔNG KHAI `catalog.categories.list`, không
 * phải một endpoint admin mới: P4e-1 cố ý chưa mở bề mặt danh mục (P4e-2).
 *
 * Hệ quả phải biết và đã chấp nhận: endpoint ấy chỉ trả danh mục ĐANG BẬT, và
 * `toursCount` của nó chỉ đếm tour đã publish — con số ấy không được hiển thị
 * ở menu lọc của admin vì nó sẽ nói dối về tour nháp. Menu chỉ dùng `id` và
 * `name`.
 *
 * Vẫn đi qua `withAdminAuth`: cùng một client, và cookie thừa trên một đường
 * công khai không làm gì cả — rẻ hơn một nhánh riêng chỉ để bỏ header đi.
 *
 * NHƯNG cookie đó không cứu được khỏi trần đọc: `AuthGuard` ngắt sớm trên route
 * `@Public()` TRƯỚC khi gắn `sessionUser`, nên nhánh miễn trừ "đã đăng nhập thì
 * bỏ qua trần" không chạy, và `withAdminAuth` cũng không gửi `x-internal-read-key`.
 * Mọi lượt mở `/tours` vì thế rơi vào `PUBLIC_READ_THROTTLE` tính theo IP egress
 * dùng chung của Vercel. Ngày `PUBLIC_READ_THROTTLE_MODE` bật `enforce`, một lượt
 * 429 ở đây sẽ kéo sập CẢ bảng tour nếu lời gọi này nằm trong `Promise.all` mà
 * không ai bắt.
 *
 * Nên: hỏng thì trả danh sách RỖNG. Menu lọc danh mục mất đi là phiền; bảng tour
 * mất đi là hỏng việc. `ToursCategoryMenu` đã có `unknownItem` nên `?category=`
 * đang lọc vẫn hiện tên tạm thay vì im lặng nói "All".
 */
export async function fetchTourCategories(cookie: string): Promise<TourCategory[]> {
  return api.catalog.categories
    .list({}, { context: withAdminAuth(cookie) })
    .catch(() => [] as TourCategory[]);
}

/**
 * Đưa một tour lên kệ hoặc rút khỏi kệ. Gửi trạng thái ĐÍCH chứ không phải
 * lệnh "đảo", và server KHÔNG chặn vì tour đang có booking sống — khách đã
 * mua vẫn đi, tour chỉ thôi được chào bán.
 */
export async function setAdminTourPublished(
  cookie: string,
  input: AdminTourSetPublishedInput,
): Promise<AdminTourSetPublishedResult> {
  return api.admin.tours.setPublished(input, { context: withAdminAuth(cookie) });
}
