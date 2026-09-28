import { isDefinedError, safe } from '@orpc/client';
import type {
  AdminTourCostsInput,
  AdminTourCreateInput,
  AdminTourCreateResult,
  AdminTourDeleteInput,
  AdminTourDeleteResult,
  AdminTourDetail,
  AdminTourDetailsInput,
  AdminTourFaqsPoliciesInput,
  AdminTourItineraryInput,
  AdminTourRow,
  AdminTourSetPublishedInput,
  AdminTourSetPublishedResult,
  Paged,
} from '@tourism/contract';
import { AdminTourGetInputSchema } from '@tourism/contract';
import type { ToursQuery } from '@/lib/tours-query';
import { api, withAdminAuth } from './client';

/**
 * Các đường của vùng tours — bọc mỏng `admin.tours.*`: danh sách và công tắc
 * đăng (spec P4e-1 §3-F11), khu làm việc của từng tour (spec F17), cộng các
 * đường đọc danh mục và điểm đến cho ô chọn. KHÔNG nuốt lỗi ở các đường ghi: mã
 * contract phải tới nơi gọi nguyên vẹn (server action đổi chúng thành một mã UI).
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

// ── Khu làm việc của một tour (spec F17) ────────────────────────────────────

/**
 * Một tour cho khu làm việc; `null` khi slug không có (trang gọi `notFound()`).
 *
 * Slug sai hình dạng của contract (vd dài quá trần) cũng là `null`, không gọi
 * API (vòng review F17): API trả 400 cho input hỏng, hàm này ném lại, và một URL
 * rác thành trang lỗi của app thay vì 404.
 */
export async function fetchAdminTour(
  cookie: string,
  slug: string,
): Promise<AdminTourDetail | null> {
  if (!AdminTourGetInputSchema.safeParse({ slug }).success) return null;
  const [error, data] = await safe(
    api.admin.tours.get({ slug }, { context: withAdminAuth(cookie) }),
  );
  if (error) {
    if (isDefinedError(error) && error.code === 'NOT_FOUND') return null;
    throw error;
  }
  return data;
}

export interface TourDestinationOption {
  id: string;
  name: string;
  /** Điểm đến đã ẩn vẫn chọn được, mang dấu "(hidden)" (spec §2b.4). */
  isActive: boolean;
}

export interface TourEditorOptions {
  categories: TourCategoryOption[];
  destinations: TourDestinationOption[];
}

/**
 * Điểm đến cho hộp New tour ở trang Tours — hỏng thì RỖNG, cùng luật
 * `fetchTourCategories`: hộp tạo mất danh sách là phiền, bảng tour mất đi là hỏng việc.
 */
export async function fetchTourDestinationOptions(
  cookie: string,
): Promise<TourDestinationOption[]> {
  return api.admin.destinations
    .list(undefined, { context: withAdminAuth(cookie) })
    .then((rows) => rows.map((row) => ({ id: row.id, name: row.name, isActive: row.isActive })))
    .catch(() => [] as TourDestinationOption[]);
}

/**
 * Hai danh sách chọn của khu làm việc — KHÔNG nuốt lỗi, khác bảng Tours: ô chọn
 * rỗng trong một form SỬA là mời admin lưu đè danh mục của tour bằng một ô
 * trống. Hỏng thì trang lỗi của app, không phải một form nói sai.
 */
export async function fetchTourEditorOptions(cookie: string): Promise<TourEditorOptions> {
  const context = { context: withAdminAuth(cookie) };
  const [categories, destinations] = await Promise.all([
    api.admin.categories.list(undefined, context),
    api.admin.destinations.list(undefined, context),
  ]);
  return {
    categories: categories.map((row) => ({ id: row.id, name: row.name, isActive: row.isActive })),
    destinations: destinations.map((row) => ({
      id: row.id,
      name: row.name,
      isActive: row.isActive,
    })),
  };
}

/** Tạo tour — sinh ra ở dạng TẮT bán (spec §2a). */
export async function createAdminTour(
  cookie: string,
  input: AdminTourCreateInput,
): Promise<AdminTourCreateResult> {
  return api.admin.tours.create(input, { context: withAdminAuth(cookie) });
}

/** Lưu tab Details; trả NGUYÊN tour server vừa ghi (có `version` mới). */
export async function updateAdminTourDetails(
  cookie: string,
  input: AdminTourDetailsInput,
): Promise<AdminTourDetail> {
  return api.admin.tours.updateDetails(input, { context: withAdminAuth(cookie) });
}

/** Thay nguyên lịch trình. */
export async function setAdminTourItinerary(
  cookie: string,
  input: AdminTourItineraryInput,
): Promise<AdminTourDetail> {
  return api.admin.tours.setItinerary(input, { context: withAdminAuth(cookie) });
}

/** Thay nguyên FAQ và chính sách. */
export async function setAdminTourFaqsPolicies(
  cookie: string,
  input: AdminTourFaqsPoliciesInput,
): Promise<AdminTourDetail> {
  return api.admin.tours.setFaqsPolicies(input, { context: withAdminAuth(cookie) });
}

/** Thay nguyên dòng chi phí; server tính lại giá vốn. */
export async function setAdminTourCosts(
  cookie: string,
  input: AdminTourCostsInput,
): Promise<AdminTourDetail> {
  return api.admin.tours.setCosts(input, { context: withAdminAuth(cookie) });
}

/** Xoá một tour chưa từng có booking — khoá ngoại của booking là trọng tài. */
export async function deleteAdminTour(
  cookie: string,
  input: AdminTourDeleteInput,
): Promise<AdminTourDeleteResult> {
  return api.admin.tours.delete(input, { context: withAdminAuth(cookie) });
}
