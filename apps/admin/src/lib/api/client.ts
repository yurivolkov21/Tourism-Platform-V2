import { createORPCClient } from '@orpc/client';
import type { ContractRouterClient } from '@orpc/contract';
import type { JsonifiedClient } from '@orpc/openapi-client';
import { OpenAPILink } from '@orpc/openapi-client/fetch';
import { contract } from '@tourism/contract';
import { apiOrigin } from './env';

/**
 * Client oRPC của admin — port từ `apps/web/src/lib/api/client.ts` và RÚT GỌN
 * theo quyết định spec P4b §2.3:
 *
 * - CHỈ đường server: mọi trang admin là server component, cookie đọc từ
 *   `next/headers` rồi forward (cùng nếp `lib/api/session.ts`). Không có
 *   nhánh `credentials: 'include'` của web (đường gọi từ browser) — khi F2
 *   cần hành vi ghi thì đi qua server action, vẫn là đường server này.
 * - KHÔNG có `next.revalidate`/cache-tag: back-office luôn đọc dữ liệu tươi,
 *   nên `cache: 'no-store'` là VÔ ĐIỀU KIỆN chứ không phải tuỳ context.
 *
 * Giữ nguyên hai thứ của bản web vì chúng là ràng buộc thật, không phải trang
 * trí: `OpenAPILink` (API mount contract theo path REST qua @orpc/nest —
 * ADR-0016 §1) và timeout 10s.
 */

/** Context per-call: chỉ mang cookie phiên của admin đang đăng nhập. */
export interface AdminApiContext {
  cookie: string;
}

/** Bọc cookie thành context: `api.admin.bookings.list(input, { context: withAdminAuth(c) })`. */
export function withAdminAuth(cookie: string): AdminApiContext {
  return { cookie };
}

/**
 * Thuần để test: trộn cookie + `no-store` vào RequestInit của một call.
 *
 * Nhận `request` gốc để merge qua `new Headers(request.headers)` thay vì gán
 * đè `init.headers` — oRPC đã tự set content-type/accept trên `request`, gán
 * đè sẽ làm mất (bài học đã ghi ở client web).
 */
export function withAdminOptions(
  request: Request,
  init: RequestInit,
  context: AdminApiContext | undefined,
): RequestInit {
  if (!context) return { ...init, cache: 'no-store' };
  const headers = new Headers(request.headers);
  headers.set('cookie', context.cookie);
  return { ...init, headers, cache: 'no-store' };
}

/**
 * Chữ ký `fetch` theo .d.ts của @orpc 1.14.8 đã pin (5 tham số, `options.context`
 * mang `AdminApiContext`) — KHÔNG theo mẫu 2 tham số của docs online.
 */
const link = new OpenAPILink<AdminApiContext>(contract, {
  url: apiOrigin(),
  fetch: (request, init, { context }) =>
    globalThis.fetch(request, {
      ...withAdminOptions(request, init ?? {}, context),
      signal: AbortSignal.timeout(10_000),
    }),
});

export const api: JsonifiedClient<ContractRouterClient<typeof contract, AdminApiContext>> =
  createORPCClient(link);
