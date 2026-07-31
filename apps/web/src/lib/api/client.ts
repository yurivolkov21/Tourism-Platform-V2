import { createORPCClient } from '@orpc/client';
import type { ContractRouterClient } from '@orpc/contract';
import type { JsonifiedClient } from '@orpc/openapi-client';
import { OpenAPILink } from '@orpc/openapi-client/fetch';
import { contract } from '@tourism/contract';
import { apiOrigin } from './env';

/** Context per-call: Server Component điều khiển Next Data Cache qua đây. */
export interface ApiClientContext {
  next?: { revalidate?: number; tags?: string[] };
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
  url: apiOrigin(),
  fetch: (request, init, { context }) =>
    globalThis.fetch(request, {
      ...withNextOptions(init ?? {}, context),
      signal: AbortSignal.timeout(10_000),
    }),
});

export const api: JsonifiedClient<ContractRouterClient<typeof contract, ApiClientContext>> =
  createORPCClient(link);
