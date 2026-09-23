import type {
  AdminTourRow,
  AdminTourSetPublishedInput,
  AdminTourSetPublishedResult,
  Paged,
} from '@tourism/contract';
import type { ToursQuery } from '@/lib/tours-query';
import { api, withAdminAuth } from './client';

/**
 * Bốn đường của vùng tours (spec P4e-1 §3-F11) — bọc mỏng `admin.tours.*` cộng
 * một đường đọc danh mục. KHÔNG nuốt lỗi ở đây: mã contract phải tới nơi gọi
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

/** Mục của menu lọc danh mục — chỉ cần từng ấy, và có cả hàng đã tắt. */
export interface TourCategoryOption {
  id: string;
  name: string;
  /** Danh mục đã ẩn vẫn có trong menu, nhưng mang dấu — xem `categoryOptionLabel`. */
  isActive: boolean;
}

/**
 * Danh mục cho menu lọc của back office — đường ADMIN `admin.categories.list`.
 *
 * Đổi nguồn ở P4e-2 (22/09) đúng như bản P4e-1 đã hẹn. Lý do phải đổi chứ
 * không phải cho gọn: từ F14 admin có nút Hide, mà endpoint CÔNG KHAI chỉ trả
 * hàng đang bật — ẩn một danh mục là menu lọc ở `/tours` của chính back office
 * mất mục ấy, nên không còn cách nào lọc ra các tour thuộc nó để đi sửa, đúng
 * lúc người ta cần nhất. Nếu URL đang mang `?categoryId=<uuid>` thì
 * `ToursCategoryMenu` rơi về `unknownItem` và bày một UUID trần cho admin đọc.
 *
 * Kèm theo, cả đoạn cảnh báo về `PUBLIC_READ_THROTTLE` của bản cũ hết hiệu
 * lực: đây là route admin có `AuthGuard`, không đi qua trần đọc công khai.
 *
 * `toursCount` của endpoint admin đếm tour ĐÃ ĐĂNG, nên vẫn KHÔNG hiển thị ở
 * menu này — nó sẽ nói dối về tour nháp. Menu chỉ lấy `id` và `name`.
 *
 * Hỏng thì trả danh sách RỖNG: menu lọc danh mục mất đi là phiền, bảng tour
 * mất đi là hỏng việc.
 */
export async function fetchTourCategories(cookie: string): Promise<TourCategoryOption[]> {
  return api.admin.categories
    .list(undefined, { context: withAdminAuth(cookie) })
    .then((rows) => rows.map((row) => ({ id: row.id, name: row.name, isActive: row.isActive })))
    .catch(() => [] as TourCategoryOption[]);
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
