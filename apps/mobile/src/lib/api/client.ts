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
  fetch: (request, init) =>
    globalThis.fetch(request, { ...init, signal: AbortSignal.timeout(10_000) }),
  // Chỗ móc session cho wishlist (D6) — nối thật khi hạ tầng @better-auth/expo
  // xong (ADR-0047 §1, ngoài phạm vi T0). Chưa có consumer nào cần header ở đây.
});

export const orpc: JsonifiedClient<ContractRouterClient<typeof contract>> = createORPCClient(link);
