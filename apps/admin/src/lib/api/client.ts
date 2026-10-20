import { createORPCClient } from '@orpc/client';
import type { ContractRouterClient } from '@orpc/contract';
import type { JsonifiedClient } from '@orpc/openapi-client';
import { OpenAPILink } from '@orpc/openapi-client/fetch';
import { contract } from '@tourism/contract';
import { apiOrigin } from './env';
import { markAdminForbidden } from './forbidden';

/**
 * Client oRPC của admin — port từ `apps/web/src/lib/api/client.ts` và RÚT GỌN
 * theo quyết định spec P4b §2.3:
 *
 * - CHỈ đường server: mọi trang admin là server component, cookie đọc từ
 *   `next/headers` rồi forward (cùng nếp `lib/api/session.ts`). Không có
 *   nhánh `credentials: 'include'` của web (đường gọi từ browser) — khi F2
 *   cần hành vi ghi thì đi qua server action, vẫn là đường server này.
 * - Mặc định `cache: 'no-store'`: back-office đọc dữ liệu tươi. Ngoại lệ duy nhất
 *   là `cacheFor` (vòng vá review F5), chỉ các bộ số trong `stats.ts` dùng.
 *
 * Giữ nguyên hai thứ của bản web vì chúng là ràng buộc thật, không phải trang
 * trí: `OpenAPILink` (API mount contract theo path REST qua @orpc/nest —
 * ADR-0016 §1) và timeout 10s.
 */

/** Context per-call: cookie phiên admin + (tuỳ chọn) signal riêng của call. */
export interface AdminApiContext {
  cookie: string;
  /** Đè trần timeout mặc định 10s — dùng cho lệnh GHI tiền (xem chỗ tạo link). */
  signal?: AbortSignal;
  /**
   * Đè luật `no-store` mặc định bằng Data Cache có TTL + tag (vòng vá review
   * F5 — stats bị refetch trên MỌI click phân trang/lọc và nằm thẳng trên
   * đường useTransition khoá nút). Số cũ nhất là `seconds`: `withAdminOptions`
   * đổi khoá cache sau mỗi khung `seconds` (review A1-13).
   *
   * Khoá cache của Next gồm MỌI header, cả cookie (`generateCacheKey` trong
   * `incremental-cache/index.js`, đọc ở next 16.3.8), nên entry thực ra theo
   * từng phiên. Dù vậy vẫn CHỈ dùng cho dữ liệu giống nhau với mọi admin như
   * stats nền tảng: đừng dựa vào chi tiết ấy cho dữ liệu theo phiên.
   */
  cacheFor?: { seconds: number; tags: string[] };
}

/** Bọc cookie thành context: `api.admin.bookings.list(input, { context: withAdminAuth(c) })`. */
export function withAdminAuth(cookie: string): AdminApiContext {
  return { cookie };
}

/**
 * Header mang số thứ tự của khung TTL hiện tại, chỉ để đổi khoá Data Cache. API
 * không đọc nó.
 */
const CACHE_WINDOW_HEADER = 'x-admin-cache-window';

/**
 * Thuần để test: trộn cookie + `no-store` vào RequestInit của một call. `now`
 * chỉ để test ghim đồng hồ.
 *
 * Nhận `request` gốc để merge qua `new Headers(request.headers)` thay vì gán
 * đè `init.headers` — oRPC đã tự set content-type/accept trên `request`, gán
 * đè sẽ làm mất (bài học đã ghi ở client web).
 */
export function withAdminOptions(
  request: Request,
  init: RequestInit,
  context: AdminApiContext | undefined,
  now: number = Date.now(),
): RequestInit {
  if (!context) return { ...init, cache: 'no-store' };
  const headers = new Headers(request.headers);
  headers.set('cookie', context.cookie);
  if (context.cacheFor) {
    // Data Cache với TTL + tag thay cho no-store — xem cảnh báo ở JSDoc
    // `cacheFor` (chỉ cho dữ liệu không theo phiên).
    const { seconds, tags } = context.cacheFor;
    // `revalidate` của Next là stale-while-revalidate: entry quá hạn vẫn được TRẢ cho
    // lượt đọc kế tiếp rồi mới làm mới ngầm, nên lượt mở trang đầu sau một quãng dài
    // mang số của lượt xem trước, có khi từ hôm trước (review A1-13). Header đổi theo
    // khung `seconds` thì entry của khung trước không bao giờ được đọc lại.
    headers.set(CACHE_WINDOW_HEADER, String(Math.floor(now / (seconds * 1000))));
    return { ...init, headers, next: { revalidate: seconds, tags } } as RequestInit;
  }
  return { ...init, headers, cache: 'no-store' };
}

/**
 * Chữ ký `fetch` theo .d.ts của @orpc 1.14.8 đã pin (5 tham số, `options.context`
 * mang `AdminApiContext`) — KHÔNG theo mẫu 2 tham số của docs online.
 *
 * Tách thành factory nhận `fetchImpl` (vòng vá review W3): interceptor gắn
 * digest 403 là mắt xích DUY NHẤT của đường "mất quyền → /not-authorized"
 * mà trước đây không test nào chạm tới — client.spec bơm một fetch trả 403
 * giả qua chính link này.
 */
export function createAdminLink(fetchImpl: typeof globalThis.fetch = globalThis.fetch) {
  return new OpenAPILink<AdminApiContext>(contract, {
    // LƯỜI có chủ đích (W3-O2): apiOrigin() fail-fast khi NODE_ENV=production
    // (thiếu env / không https tới host thật), mà `next build` NÀO cũng chạy
    // production — gọi ở module scope là giết build local/CI. Để dạng hàm thì
    // phép kiểm chạy đúng "lúc gọi" đầu tiên ở runtime, với env runtime thật.
    url: () => apiOrigin(),
    // MỘT chỗ cho mọi đường đọc/ghi (ADR-0026 AMEND 3 §B): lỗi 403 mang digest
    // ADMIN_FORBIDDEN để error boundary đưa admin bị thu hồi quyền về
    // /not-authorized; server action đã classify 403 riêng — digest không đổi
    // hành vi các đường đó.
    interceptors: [
      async (options) => {
        try {
          return await options.next();
        } catch (error) {
          throw markAdminForbidden(error);
        }
      },
    ],
    fetch: (request, init, { context }) =>
      fetchImpl(request, {
        ...withAdminOptions(request, init ?? {}, context),
        // Tôn trọng signal PER-CALL nếu caller đặt (qua context) — 10s chỉ là
        // mặc định cho đường ĐỌC. Money-path ghi (refund gọi provider bên
        // trong request) cần trần dài hơn: abort trong lúc API đã commit là
        // hạt giống refund đúp (review F2 31/08).
        signal: context?.signal ?? AbortSignal.timeout(10_000),
      }),
  });
}

const link = createAdminLink();

export const api: JsonifiedClient<ContractRouterClient<typeof contract, AdminApiContext>> =
  createORPCClient(link);
