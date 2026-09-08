import { createORPCClient } from '@orpc/client';
import type { ContractRouterClient } from '@orpc/contract';
import type { JsonifiedClient } from '@orpc/openapi-client';
import { OpenAPILink } from '@orpc/openapi-client/fetch';
import { contract } from '@tourism/contract';
import { apiOrigin } from './env';

/** Context per-call: Server Component điều khiển Next Data Cache qua đây. */
export interface ApiClientContext {
  next?: { revalidate?: number; tags?: string[] };
  /**
   * Đường gọi CẦN session (ADR-0017 §3) — mở rộng CÙNG khuôn với `next` ở
   * trên, không chế đường song song. Data per-user nên LUÔN ép
   * `cache: 'no-store'`, không đi kèm `next` (revalidate/tag) ở field trên
   * trong cùng một context.
   * - `{ credentials: 'include' }`: gọi từ browser — cookie httpOnly do API
   *   phát tự gửi kèm request, JS không cần đụng tay (ADR-0017 §1).
   * - `{ cookie }`: gọi từ server — forward cookie đọc từ `next/headers`
   *   (dựng qua `withAuthHeaders` bên dưới, cùng cách đọc của `session.ts`).
   */
  auth?: { credentials: 'include' } | { cookie: string };
}

/**
 * Server: bọc cookie forward cho một call oRPC cần session (ADR-0017 §3) —
 * dùng thẳng làm `context`, vd
 * `api.account.me(undefined, { context: withAuthHeaders(cookieHeader) })`.
 */
export function withAuthHeaders(cookie: string): ApiClientContext {
  return { auth: { cookie } };
}

/**
 * Browser: ngữ cảnh cho call oRPC cần session gọi TỪ client component
 * (Task 7/A2 — khu account: pay-now/cancel/bỏ-lưu…). Cookie httpOnly do API
 * phát tự gửi kèm request qua `credentials: 'include'`, JS không cần đọc/
 * forward tay (khác `withAuthHeaders` — bản đó cho đường SERVER, forward
 * cookie đọc từ `next/headers`), vd
 * `api.bookings.checkout({ code }, { context: withBrowserAuth() })`.
 */
export function withBrowserAuth(): ApiClientContext {
  return { auth: { credentials: 'include' } };
}

/**
 * Thuần để test: gắn credentials/cookie cho call cần session vào RequestInit
 * (mở rộng cùng khuôn `withNextOptions`). Nhận thêm `request` gốc (KHÁC
 * `withNextOptions`) để merge header qua `new Headers(request.headers)` thay
 * vì gán đè `init.headers` — oRPC đã tự set content-type/accept trên
 * `request`, gán đè sẽ làm mất các header đó (đo bằng typecheck chữ ký
 * `LinkFetchClientOptions.fetch` của @orpc/client 1.14.8: `request` là
 * `Request` đầy đủ, `init` chỉ có `{ redirect? }`).
 */
export function withAuthOptions(
  request: Request,
  init: RequestInit,
  context: ApiClientContext | undefined,
): RequestInit {
  if (!context?.auth) return init;
  if ('credentials' in context.auth) {
    // no-store CẢ nhánh browser (W3-O3, audit cụm 7): response per-user vào
    // HTTP cache (disk/shared cache của browser, proxy) là rò giữa các phiên
    // trên cùng máy — JSDoc trên đã hứa từ đầu, nhánh server có mà nhánh này
    // thiếu. (bfcache là chuyện của Cache-Control trên DOCUMENT, không phải
    // của một fetch con — đừng trông vào dòng này cho việc đó.)
    return { ...init, credentials: context.auth.credentials, cache: 'no-store' };
  }
  const headers = new Headers(request.headers);
  headers.set('cookie', context.auth.cookie);
  return { ...init, headers, cache: 'no-store' };
}

/**
 * Thuần để test: trộn tuỳ chọn Next cache của context vào RequestInit.
 * Kiểu trả về CHỈ là `RequestInit` (không intersect thêm `next` riêng): Next.js
 * đã tự global-augment `RequestInit.next` (xem `next/types/global.d.ts`,
 * `revalidate?: number | false`) nên intersect thêm field `next` hẹp hơn
 * (`revalidate?: number`) của riêng ta sẽ xung đột kiểu khi gán ngược —
 * bắt được lúc chạy `tsc`, không phải đoán.
 */
export function withNextOptions(
  init: RequestInit,
  context: ApiClientContext | undefined,
): RequestInit {
  return context?.next ? { ...init, next: context.next } : init;
}

/** Header server-to-server miễn bucket đọc công khai của API (ADR-0037 AMEND 2, vòng vá review W4). */
export const INTERNAL_READ_KEY_HEADER = 'x-internal-read-key';

/**
 * Thuần để test: gắn `x-internal-read-key` cho call phát TỪ SERVER (SSR /
 * build / ISR / route handler) khi env `INTERNAL_READ_KEY` có mặt — API so
 * khớp và miễn trần đọc 300/60s theo IP cho đường này (vòng vá review W4:
 * 61 route prerender × 2–6 call đi từ MỘT egress IP dùng chung của Vercel, và
 * 429 lúc build là build đỏ). KHÔNG BAO GIỜ gắn ở browser: env này không có
 * tiền tố NEXT_PUBLIC nên bundle client không thấy, và có thấy cũng không
 * được gửi — key lộ ra là mọi người đều "nội bộ". Gọi SAU `withAuthOptions`
 * để giữ header cookie nhánh server đã đặt.
 */
export function withInternalReadKey(
  request: Request,
  init: RequestInit,
  key: string | undefined,
  side: 'server' | 'browser',
): RequestInit {
  if (side !== 'server' || !key) return init;
  const headers = new Headers(init.headers ?? request.headers);
  headers.set(INTERNAL_READ_KEY_HEADER, key);
  return { ...init, headers };
}

/**
 * Link OpenAPI (KHÔNG phải RPCLink): API mount contract theo path REST qua
 * @orpc/nest nên client phải nói chuyện bằng đúng các path đó (ADR-0016 §1).
 * Timeout 10s mặc định — Nexora không có timeout ở đâu cả, đây là điểm vá.
 *
 * Chữ ký `fetch` đối chiếu trực tiếp .d.ts của bản @orpc 1.14.8 đã pin (KHÔNG
 * theo mẫu docs chung — bản docs online cho signature 2 tham số `(request,
 * init)`, còn type thật của bản pin nhận 5 tham số
 * `(request, init, options, path, input)` với `options.context` mang
 * `ApiClientContext`). `init` ở đây cũng KHÔNG phải `RequestInit` đầy đủ —
 * type gốc là `{ redirect?: Request['redirect'] }` — nhưng do mọi field của
 * `RequestInit` đều optional nên vẫn gán được vào tham số `RequestInit` của
 * `withNextOptions` (kiểm bằng typecheck, không đoán).
 */
const link = new OpenAPILink<ApiClientContext>(contract, {
  // LƯỜI có chủ đích (vòng vá review W3, cùng khuôn admin): apiOrigin() nay
  // fail-fast (thiếu env/không https ở production) — gọi ở module scope là
  // nổ lúc import: prerender chết với stack ở đây, chunk browser nổ khi
  // hydrate ngoài cây render nên error.tsx không bắt. Dạng hàm thì phép kiểm
  // chạy đúng "lúc gọi" đầu tiên, với env runtime thật.
  url: () => apiOrigin(),
  fetch: (request, init, { context }) =>
    globalThis.fetch(request, {
      ...withInternalReadKey(
        request,
        withAuthOptions(request, withNextOptions(init ?? {}, context), context),
        process.env.INTERNAL_READ_KEY,
        typeof window === 'undefined' ? 'server' : 'browser',
      ),
      signal: AbortSignal.timeout(10_000),
    }),
});

export const api: JsonifiedClient<ContractRouterClient<typeof contract, ApiClientContext>> =
  createORPCClient(link);
