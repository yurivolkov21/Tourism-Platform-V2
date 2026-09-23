import { createORPCClient } from '@orpc/client';
import type { ContractRouterClient } from '@orpc/contract';
import type { JsonifiedClient } from '@orpc/openapi-client';
import { OpenAPILink } from '@orpc/openapi-client/fetch';
import { contract } from '@tourism/contract';
import { env } from '@/lib/env';

/**
 * Link OpenAPI (KHÔNG phải RPCLink, ADR-0016 §1 / ADR-0047 §1): API mount
 * contract theo path REST qua @orpc/nest.
 *
 * `url` LƯỜI (hàm, không giá trị) — `env()` ném lỗi khi thiếu biến; gọi ở
 * module scope là nổ lúc import, trước khi ErrorBoundary của app kịp dựng.
 */
const link = new OpenAPILink(contract, {
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
  fetch: (request, init) =>
    globalThis.fetch(request, {
      ...init,
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(10_000)]),
    }),
  // Chỗ móc session cho wishlist (D6) — nối thật khi hạ tầng @better-auth/expo
  // xong (ADR-0047 §1, ngoài phạm vi T0). Chưa có consumer nào cần header ở đây.
});

export const orpc: JsonifiedClient<ContractRouterClient<typeof contract>> = createORPCClient(link);
