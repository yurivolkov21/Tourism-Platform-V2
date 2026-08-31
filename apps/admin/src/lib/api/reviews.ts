import type { AdminReview, ModerateReviewInput, Paged } from '@tourism/contract';
import { type ReviewsQuery, toReviewsListInput } from '@/lib/reviews-query';
import { api, withAdminAuth } from './client';

/**
 * Hai đường của vùng reviews (spec P4b §3-F4) — bọc mỏng `admin.reviews.list`
 * (đọc) và `moderate` (ghi). P4b F1–F4 KHÔNG thêm endpoint nào.
 */

/**
 * Một trang review (mới nhất trước — server đã orderBy `createdAt desc, id
 * desc`). Nhận trạng thái BẢNG (`ReviewsQuery`, field `limit` của kit) và
 * dịch sang input contract bằng `toReviewsListInput` — cái bẫy `limit` ↔
 * `pageSize` đã ghi ở đó, đừng gọi thẳng `api.admin.reviews.list(query)`.
 */
export async function fetchAdminReviews(
  cookie: string,
  query: ReviewsQuery,
): Promise<Paged<AdminReview>> {
  return api.admin.reviews.list(toReviewsListInput(query), { context: withAdminAuth(cookie) });
}

/**
 * Duyệt/bỏ duyệt — bọc mỏng đúng như đường đọc: KHÔNG nuốt lỗi ở đây, mã
 * contract phải tới được UI nguyên vẹn (bất biến §2.4); server action mới là
 * chỗ phân loại (`classifyModerateError`), vì đó là biên cuối cùng còn giữ
 * được kiểu lỗi.
 *
 * Trần 30s RIÊNG cho lệnh này thay vì 10s mặc định của đường đọc. Không phải
 * vì tiền (moderate không đụng ledger) mà vì nó là transaction 4-trong-1 có
 * `SELECT … FOR UPDATE` trên CẢ row review lẫn row tour: hai admin cùng duyệt
 * hai review của MỘT tour thì người sau xếp hàng chờ người trước commit. Abort
 * ở 10s không huỷ được transaction đã chạy phía server — nó chỉ biến một lệnh
 * có thể đã thành công thành "không rõ kết cục" trên màn hình admin.
 */
export async function moderateReview(
  cookie: string,
  input: ModerateReviewInput,
): Promise<AdminReview> {
  return api.admin.reviews.moderate(input, {
    context: { cookie, signal: AbortSignal.timeout(30_000) },
  });
}
