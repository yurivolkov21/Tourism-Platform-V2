import { createORPCClient } from '@orpc/client';
import type { ContractRouterClient } from '@orpc/contract';
import type { JsonifiedClient } from '@orpc/openapi-client';
import { OpenAPILink } from '@orpc/openapi-client/fetch';
import { createTanstackQueryUtils } from '@orpc/tanstack-query';
import { contract } from '@tourism/contract';
import { getAuthClient } from '@/lib/auth-client';
import { env } from '@/lib/env';

/**
 * Context per-call cho đường CẦN session (D6, cùng khuôn `ApiClientContext`
 * của web) — mobile không có cookie jar nên phải TỰ đính header, khác
 * `credentials:'include'` bên trình duyệt.
 */
export interface ApiClientContext {
  auth?: { cookie: string };
}

/**
 * Đính cookie phiên đang lưu trong `expo-secure-store` (qua action
 * `getCookie()` mà plugin `expoClient` thêm vào client — cách chính thức
 * better-auth tài liệu cho việc gắn phiên vào một HTTP client KHÁC ngoài
 * `authClient.$fetch`, xem `auth-client.ts`). Dùng cho mọi call oRPC cần auth
 * (wishlist D6, sau này booking…), vd
 * `orpc.wishlist.set({...}, { context: withMobileAuth() })`.
 */
export function withMobileAuth(): ApiClientContext {
  return { auth: { cookie: getAuthClient().getCookie() } };
}

/**
 * Link OpenAPI (KHÔNG phải RPCLink, ADR-0016 §1 / ADR-0047 §1): API mount
 * contract theo path REST qua @orpc/nest.
 *
 * `url` LƯỜI (hàm, không giá trị) — `env()` ném lỗi khi thiếu biến; gọi ở
 * module scope là nổ lúc import, trước khi ErrorBoundary của app kịp dựng.
 */
const link = new OpenAPILink<ApiClientContext>(contract, {
  url: () => env().apiUrl,
  // Ghép signal huỷ của caller với timeout 10s thay vì ghi đè. Signal huỷ
  // (vd. TanStack Query huỷ query khi unmount) KHÔNG nằm ở `init` — kiểm tra
  // thẳng nguồn (@orpc/client `LinkFetchClient.call`) thấy `init` ở đây luôn
  // là hằng `{ redirect: 'manual' }`, không mang signal nào cả; oRPC ghép
  // signal của caller (`ClientOptions.signal`) THẲNG vào `request` lúc dựng
  // (`toFetchRequest` ở @orpc/standard-server-fetch: `new Request(url, {
  // signal: standardRequest.signal, ... })`). Trước đây gọi
  // `fetch(request, { signal: AbortSignal.timeout(...) })` nên theo spec Fetch,
  // `init.signal` đè mất `request.signal` — query đã huỷ vẫn chạy tiếp tới
  // lúc xong mới thôi.
  //
  // `AbortSignal.any`/`AbortSignal.timeout` chỉ chạy được ở đây nhờ winter
  // runtime của Expo SDK 57 polyfill chúng lên global RN — polyfill
  // `abort-controller@3.0.0` của bare React Native KHÔNG có static nào trong
  // hai cái này. Đừng "dọn" giả định phụ thuộc Expo này sau này mà không kiểm
  // tra lại, không thì ăn `TypeError` âm thầm trên bare RN.
  fetch: (request, init, { context }) => {
    // D6: đường cần auth (`wishlist.*`) đính `Cookie` qua `withMobileAuth()`
    // — merge vào header GỐC của `request` (giữ content-type/accept oRPC đã
    // set), không gán đè `init.headers`, cùng luật `withAuthOptions` bên web.
    const headers = context?.auth ? new Headers(request.headers) : undefined;
    if (headers && context?.auth) headers.set('cookie', context.auth.cookie);

    return globalThis.fetch(request, {
      ...init,
      ...(headers ? { headers } : null),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]),
    });
  },
});

type ApiClient = JsonifiedClient<ContractRouterClient<typeof contract, ApiClientContext>>;

const apiClient: ApiClient = createORPCClient(link);

/**
 * Bọc qua `@orpc/tanstack-query` (ADR-0047 §2) — màn gọi thẳng
 * `orpc.<resource>.<method>.queryOptions(...)` qua `useQuery`, không tự viết
 * tay tri-state fetch cho từng màn.
 */
export const orpc = createTanstackQueryUtils(apiClient);
