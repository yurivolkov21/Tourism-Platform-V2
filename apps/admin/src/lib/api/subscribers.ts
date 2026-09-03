import type {
  AdminSubscribersListResult,
  AdminSubscriberUnsubscribeInput,
  AdminSubscriberUnsubscribeResult,
  SubscriberRow,
} from '@tourism/contract';
import { EXPORT_PAGE_SIZE, fetchAllPages, type PagedExport } from '@/lib/export-pages';
import type { SubscribersQuery } from '@/lib/subscribers-query';
import { api, withAdminAuth } from './client';

/**
 * Ba đường của vùng subscribers (spec P4c §3-F10) — bọc mỏng
 * `admin.subscribers.*`. KHÔNG nuốt lỗi ở đây: hai mã contract phải tới nơi
 * gọi nguyên vẹn (server action đổi chúng thành một mã UI).
 */

/**
 * Một trang địa chỉ (mới nhất trước — server đã orderBy `createdAt desc`),
 * kèm danh sách `sources` distinct cho Select lọc. Input là kết quả
 * `parseSubscribersSearchParams`, tức đã clamp.
 *
 * KHÔNG cache: bảng này có ba kẻ ghi và chỉ một là admin (xem
 * `fetchAdminSubscribersStats`).
 */
export async function fetchAdminSubscribers(
  cookie: string,
  query: SubscribersQuery,
): Promise<AdminSubscribersListResult> {
  return api.admin.subscribers.list(query, { context: withAdminAuth(cookie) });
}

/**
 * TOÀN BỘ tập đang lọc, gom bằng cách lặp trang trên chính
 * `admin.subscribers.list` (nguồn của `/subscribers/export`).
 *
 * Vòng lặp và ba chốt ngân sách nằm ở `lib/export-pages.ts` dùng chung với
 * bookings — ở đây chỉ còn phần riêng của vùng: bộ lọc nào và dedupe theo
 * cột nào. `includeSources: false` là chốt riêng của vùng này, cùng khuôn
 * `includeMedia: false` của bookings (vòng vá review F10): file không có ô
 * nào cho danh sách nguồn, nên khỏi bắt API `GROUP BY` toàn bảng 20 lần chỉ
 * để vứt đi.
 */
export async function fetchAllAdminSubscribers(
  cookie: string,
  query: SubscribersQuery,
): Promise<PagedExport<SubscriberRow>> {
  return fetchAllPages(
    (page, signal) =>
      api.admin.subscribers.list(
        { ...query, page, limit: EXPORT_PAGE_SIZE, includeSources: false },
        { context: { cookie, signal } },
      ),
    (row) => row.id,
  );
}

/**
 * Gỡ một địa chỉ khỏi danh sách thay khách — server chạy MỘT câu UPDATE có
 * guard, nên hàng đã rời danh sách từ trước trả `ALREADY_UNSUBSCRIBED` chứ
 * không âm thầm đè mốc rút consent cũ.
 */
export async function unsubscribeAdminSubscriber(
  cookie: string,
  input: AdminSubscriberUnsubscribeInput,
): Promise<AdminSubscriberUnsubscribeResult> {
  return api.admin.subscribers.unsubscribe(input, { context: withAdminAuth(cookie) });
}
