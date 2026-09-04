import type {
  AdminBookingsStats,
  AdminCancellationsStats,
  AdminEnquiriesStats,
  AdminOutboxStats,
  AdminPaymentEventsStats,
  AdminReviewsStats,
  AdminSubscribersStats,
} from '@tourism/contract';
import { api, withAdminAuth } from './client';

/**
 * Bảy đường đọc số liệu vùng (spec P4b §3-F5) — bọc mỏng `admin.stats.*`.
 *
 * ## Vùng nào cache, vùng nào không — LUẬT CHUNG
 *
 * Cache theo tag CHỈ khi MỌI kẻ ghi bảng đều là server action của admin. Ba
 * vùng của P4b (bookings/cancellations/reviews) đúng như vậy nên cache 60s
 * theo `ADMIN_STATS_TAG`; bốn vùng của P4c thì không, và mỗi cái ghi lý do
 * riêng ở JSDoc của mình (worker · webhook provider · form "Inquire Now" ·
 * form footer + link HMAC trong email khách).
 *
 * Vì sao ba vùng kia CÓ cache (vòng vá review F5): `no-store` từng bắt refetch
 * trọn bộ stats trên MỌI click phân trang/lọc/refresh-sau-ghi dù hàng card
 * không phụ thuộc searchParams — và vì refresh nằm trong `useTransition`, nó
 * kéo dài luôn thời gian khoá nút Approve/Deny. Cửa sổ đo là 28 ngày nên 60s
 * staleness là số lẻ thứ năm sau dấu phẩy; còn "tươi ngay sau khi CHÍNH MÌNH
 * ghi" thì server action gọi `updateTag(ADMIN_STATS_TAG)`. An toàn chia sẻ
 * cache giữa admin: stats là số nền tảng, không theo phiên (xem cảnh báo
 * `cacheFor` ở client.ts).
 *
 * `undefined` ở vị trí input là ĐÚNG chữ ký với SÁU procedure không khai
 * `.input()` — cùng cách gọi `catalog.destinations.list` bên web. Ngoại lệ là
 * `bookings`: từ ADR-0028 nó nhận khoảng ngày của bộ lọc.
 *
 * KHÔNG nuốt lỗi ở đây: trang gọi fetcher stats cùng `Promise.all` với list,
 * nên một endpoint stats hỏng sẽ rơi vào `app/error.tsx` y như khi list hỏng.
 * Cố ý — "vẫn hiện bảng, âm thầm giấu hàng card" nghĩa là một endpoint chết
 * có thể sống nhiều tuần mà không ai biết.
 */

/** Tag Data Cache của ba endpoint stats CÓ cache — action ghi nào đổi số thì update. */
export const ADMIN_STATS_TAG = 'admin-stats';

const STATS_CACHE_SECONDS = 60;

function statsContext(cookie: string) {
  return { cookie, cacheFor: { seconds: STATS_CACHE_SECONDS, tags: [ADMIN_STATS_TAG] } };
}

/**
 * Bộ số `/bookings` — endpoint stats DUY NHẤT nhận khoảng ngày (ADR-0028):
 * hàng card tính đúng kỳ mà bảng ngay dưới nó đang lọc.
 *
 * Truyền `{}` khi không lọc (`?dates=all`) chứ không phải `undefined`: schema
 * khai hai field optional nên object rỗng là input hợp lệ, và server rơi về
 * cửa sổ trượt 28 ngày.
 *
 * Cache VẪN dùng được dù có tham số: Data Cache của Next key theo URL, mà
 * `from`/`to` nằm trên query string — mỗi khoảng một entry, và
 * `ADMIN_STATS_TAG` vẫn `updateTag` được cả cụm sau mỗi lệnh ghi. Mặc định là
 * tháng hiện tại nên đại đa số lượt truy cập chung một key.
 */
export async function fetchAdminBookingsStats(
  cookie: string,
  range?: { from?: string; to?: string },
): Promise<AdminBookingsStats> {
  return api.admin.stats.bookings(range ?? {}, { context: statsContext(cookie) });
}

/**
 * Bộ số `/cancellations` — endpoint stats thứ hai nhận khoảng ngày (ADR-0028
 * §AMEND). Khác `/bookings` ở chỗ vùng này mặc định KHÔNG lọc ngày, nên `{}`
 * là ca thường gặp chứ không phải ngoại lệ; lúc đó server dùng cửa sổ trượt
 * 28 ngày như trước.
 */
export async function fetchAdminCancellationsStats(
  cookie: string,
  range?: { from?: string; to?: string },
): Promise<AdminCancellationsStats> {
  return api.admin.stats.cancellations(range ?? {}, { context: statsContext(cookie) });
}

export async function fetchAdminReviewsStats(cookie: string): Promise<AdminReviewsStats> {
  return api.admin.stats.reviews(undefined, { context: statsContext(cookie) });
}

/**
 * F7 — KHÔNG cache (vòng vá review F7), khác ba vùng trên: hai ảnh chụp
 * queued/failed hứa "đúng bằng số hàng của bảng bên dưới", mà kẻ đổi hàng đợi
 * là WORKER drain mỗi phút — không server action nào gọi được `updateTag` hộ
 * nó. Cache 60s ở đây là card cãi nhau với bảng ngay giữa lúc triage sự cố.
 */
export async function fetchAdminOutboxStats(cookie: string): Promise<AdminOutboxStats> {
  return api.admin.stats.outbox(undefined, { context: withAdminAuth(cookie) });
}

/**
 * F8 — KHÔNG cache, cùng luật outbox (vòng vá review F8; bản đầu cache 60s
 * theo tag). Kẻ đổi sổ là WEBHOOK của provider — ngoài mọi `updateTag` của
 * admin — mà bảng bên dưới đọc tươi ở mỗi lần điều hướng: card "Unprocessed
 * now" cache 60s đứng cạnh một bảng tươi là hai con số khác nhau về cùng
 * một thứ trên cùng một màn hình, đúng chỗ contract hứa "đúng bằng
 * `?unprocessed=true`". Hai query đếm mỗi lần render là giá chấp nhận được
 * cho một bảng cỡ này.
 */
export async function fetchAdminPaymentEventsStats(
  cookie: string,
): Promise<AdminPaymentEventsStats> {
  return api.admin.stats.paymentEvents(undefined, { context: withAdminAuth(cookie) });
}

/**
 * F9 — KHÔNG cache, cùng luật outbox/payment events (vòng vá review F9; bản
 * đầu cache 60s với lý do "chỉ admin bấm nút mới đổi số" — sai: form
 * "Inquire Now" CÔNG KHAI ghi lead NEW, tức đổi cả `created` lẫn `open`,
 * và đường đó không gọi `updateTag` nào). Luật chung để vùng sau khỏi suy
 * luận lại: cache theo tag CHỈ khi mọi kẻ ghi bảng đều là server action của
 * admin (F2–F5); có kẻ ghi ngoài — worker, webhook, form khách — thì không.
 */
export async function fetchAdminEnquiriesStats(cookie: string): Promise<AdminEnquiriesStats> {
  return api.admin.stats.enquiries(undefined, { context: withAdminAuth(cookie) });
}

/**
 * F10 — KHÔNG cache, cùng luật outbox/payment events/enquiries. Bảng
 * `subscribers` có BA kẻ ghi và chỉ MỘT trong ba là server action của admin:
 * form footer công khai (`subscribe`) đổi `created` và `active`, còn link
 * HMAC trong email khách (`unsubscribe`/`resubscribe`) đổi `unsubscribed` và
 * `active` — không đường nào trong hai đường đó gọi `updateTag` được. Card
 * "Active now" hứa khớp ĐÚNG số hàng của `?active=true`, mà bảng bên dưới
 * đọc tươi mỗi lần điều hướng: cache 60s ở đây là hai con số khác nhau về
 * cùng một thứ trên cùng một màn hình.
 */
export async function fetchAdminSubscribersStats(cookie: string): Promise<AdminSubscribersStats> {
  return api.admin.stats.subscribers(undefined, { context: withAdminAuth(cookie) });
}
