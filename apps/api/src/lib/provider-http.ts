/**
 * Seam HTTP-POST tối giản, inject được, cho các call ra provider (Stripe,
 * PayPal, Resend). D2 đã chốt: P2 KHÔNG chạy network smoke — mỗi provider client
 * nhận một {@link HttpPost} trong constructor để unit test stub được đường
 * truyền và assert đúng shape request offline; production dùng
 * {@link defaultHttpPost} (global fetch, Node ≥ 18).
 *
 * Cố ý chỉ POST và body dạng string: mọi call ra provider của money-path đều là
 * POST, và giữ seam nhỏ vậy giúp stub chỉ gọn một dòng.
 */

export interface HttpPostInit {
  headers: Record<string, string>;
  body: string;
}

/** Thứ stub ghi lại mỗi call (url + các field init, đã flatten). */
export interface HttpPostCall extends HttpPostInit {
  url: string;
}

export interface HttpPostResponse {
  status: number;
  /** Text response thô — caller tự JSON-parse khi cần JSON. */
  body: string;
}

export type HttpPost = (url: string, init: HttpPostInit) => Promise<HttpPostResponse>;

/**
 * Trần thời gian cho MỌI call ra provider.
 *
 * Vì sao cần: Nexora dùng SDK `stripe` chính chủ nên được hưởng timeout mặc
 * định của SDK. v2 cố ý không kéo SDK về (xem `stripe.gateway.ts`) — quyết
 * định đúng, nhưng để lại lỗ: `fetch()` trần KHÔNG có timeout mặc định. Nếu
 * Stripe/PayPal/Resend nhận kết nối rồi treo, request tạo booking hoặc vòng
 * outbox-drain sẽ treo vô thời hạn, giữ luôn connection trong pool.
 *
 * 15s: thoải mái cho p99 của cả ba provider (OAuth PayPal chậm nhất), mà vẫn
 * ngắn hơn nhiều so với timeout mặc định phía nền tảng deploy.
 */
export const PROVIDER_HTTP_TIMEOUT_MS = 15_000;

/** Bản cài production trên global fetch. */
export const defaultHttpPost: HttpPost = async (url, init) => {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: init.headers,
      body: init.body,
      signal: AbortSignal.timeout(PROVIDER_HTTP_TIMEOUT_MS),
    });
    return { status: response.status, body: await response.text() };
  } catch (err) {
    // AbortError/TimeoutError trần không nói call nào chết. Bọc lại kèm host
    // để log production truy được ngay là provider nào treo — các lỗi mạng
    // khác (ECONNREFUSED, DNS…) ném nguyên, không nhầm thành timeout.
    const name = err instanceof Error ? err.name : '';
    if (name === 'AbortError' || name === 'TimeoutError') {
      throw new Error(
        `provider HTTP POST timed out after ${PROVIDER_HTTP_TIMEOUT_MS}ms: ${new URL(url).host}`,
        { cause: err },
      );
    }
    throw err;
  }
};
