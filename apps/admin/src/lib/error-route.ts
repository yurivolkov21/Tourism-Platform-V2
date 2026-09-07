import { ADMIN_FORBIDDEN_DIGEST } from '@/lib/api/forbidden';

/**
 * Lõi thuần của `app/error.tsx` (vòng vá review W3): digest nào thì đưa
 * người dùng đi đâu — tách ra lib để test được (vitest admin không quét
 * `src/app/**`) và để hằng ADMIN_FORBIDDEN không lệch giữa nơi gắn (client
 * oRPC) và nơi đọc (boundary). `null` = ở lại màn lỗi chung (Try again).
 */
export function routeForErrorDigest(digest: string | undefined): string | null {
  if (digest === ADMIN_FORBIDDEN_DIGEST) return '/not-authorized';
  return null;
}
