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

/** Bản cài production trên global fetch. */
export const defaultHttpPost: HttpPost = async (url, init) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: init.headers,
    body: init.body,
  });
  return { status: response.status, body: await response.text() };
};
