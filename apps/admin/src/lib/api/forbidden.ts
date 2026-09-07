import { ORPCError } from '@orpc/client';

/**
 * Digest đánh dấu "mất quyền admin" (ADR-0026 AMEND 3 §B): tầng client oRPC
 * gắn lên MỌI lỗi HTTP 403 (interceptor của link — một chỗ cho cả đường đọc
 * lẫn ghi), error boundary client thấy digest này thì đưa về /not-authorized
 * thay vì màn "Try again" vô vọng. Next chuyển `digest` sang client boundary
 * kể cả production — đó là kênh DUY NHẤT mang được tín hiệu qua boundary khi
 * message lỗi đã bị Next che.
 */
export const ADMIN_FORBIDDEN_DIGEST = 'ADMIN_FORBIDDEN';

/** Thuần để test: gắn digest cho lỗi 403, mọi lỗi khác trả nguyên. */
export function markAdminForbidden(error: unknown): unknown {
  if (error instanceof ORPCError && error.status === 403) {
    (error as { digest?: string }).digest = ADMIN_FORBIDDEN_DIGEST;
  }
  return error;
}
