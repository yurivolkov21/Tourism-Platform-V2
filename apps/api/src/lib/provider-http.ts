/**
 * Minimal injectable HTTP-POST seam for outbound provider calls (Stripe,
 * PayPal, Resend). D2 resolved: NO network smoke in P2 — every provider client
 * takes an {@link HttpPost} in its constructor so unit tests stub the wire and
 * assert the exact request shape offline; production uses {@link defaultHttpPost}
 * (global fetch, Node ≥ 18).
 *
 * Deliberately POST-only and string-bodied: every provider call the money-path
 * makes is a POST, and keeping the seam this small makes stubs one-liners.
 */

export interface HttpPostInit {
  headers: Record<string, string>;
  body: string;
}

/** What a stub records per call (url + the init fields, flattened). */
export interface HttpPostCall extends HttpPostInit {
  url: string;
}

export interface HttpPostResponse {
  status: number;
  /** Raw response text — callers JSON-parse when they expect JSON. */
  body: string;
}

export type HttpPost = (url: string, init: HttpPostInit) => Promise<HttpPostResponse>;

/** Production implementation over global fetch. */
export const defaultHttpPost: HttpPost = async (url, init) => {
  const response = await fetch(url, { method: 'POST', headers: init.headers, body: init.body });
  return { status: response.status, body: await response.text() };
};
