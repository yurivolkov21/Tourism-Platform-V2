import type { DeleteAccountResult } from '@/features/account/delete-account-flow';

/** Tập con của `fetch` mà hàm này dùng — tránh overload của `typeof fetch`
 *  làm khó kiểu mock trong test. */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/**
 * Gọi `DELETE /api/account` (ADR-0017 §7b, `AccountController.deleteOwnAccount`)
 * — route REST thuần, KHÔNG nằm trong contract oRPC (cùng lý do web có
 * `apps/web/src/lib/api/account.ts` riêng), nên fetch thẳng thay vì qua `orpc`.
 *
 * Khác web: không có cookie jar nên tự đính `cookie` (giá trị
 * `authClient.getCookie()`, cùng khuôn `withMobileAuth()` của wishlist).
 * `content-type: application/json` là BẮT BUỘC — hook `onRequest` ở
 * `apps/api/src/bootstrap.ts` trả 415 cho mọi request ghi không phải JSON.
 *
 * Tham số `apiUrl`/`cookie`/`fetchImpl` tiêm vào để test không cần env thật.
 * Server trả 204 rỗng khi thành công — không parse body.
 */
export async function deleteAccountRequest(
  password: string,
  {
    apiUrl,
    cookie,
    fetchImpl = globalThis.fetch,
  }: {
    apiUrl: string;
    cookie: string;
    fetchImpl?: FetchLike;
  },
): Promise<DeleteAccountResult> {
  let response: Response;
  try {
    response = await fetchImpl(`${apiUrl}/api/account`, {
      method: 'DELETE',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ password }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    // Mất mạng / quá 10s — status 0 để flow rơi về copy generic.
    return { ok: false, status: 0 };
  }
  if (response.ok) return { ok: true };

  // Envelope lỗi chung {code, message} — body không phải JSON (proxy chen
  // giữa…) thì bỏ qua code, flow vẫn quyết theo status.
  const code = await response
    .json()
    .then((body: unknown) =>
      typeof body === 'object' && body !== null && 'code' in body
        ? String((body as { code: unknown }).code)
        : undefined,
    )
    .catch(() => undefined);
  return code === undefined
    ? { ok: false, status: response.status }
    : { ok: false, status: response.status, code };
}
