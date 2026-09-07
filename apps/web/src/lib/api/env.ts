/**
 * Nguồn env DUY NHẤT của tầng dữ liệu web (ADR-0016 §6 + AMEND 1) — Nexora
 * lặp base-URL thủ công ở 8 file, đây là chỗ sửa bài học đó. Giá trị là
 * ORIGIN TRẦN (không kèm /api): path đã nằm trong contract.
 *
 * Origin theo PHÍA (audit 05/09 cụm 7): `API_URL` CHỈ có nghĩa phía server —
 * Next chỉ inline `NEXT_PUBLIC_*` vào bundle browser, nên nhánh `API_URL`
 * trong browser không bao giờ tồn tại; cấu hình "API_URL riêng cho server"
 * từng làm SSR xanh còn MỌI nút ghi từ browser bắn về fallback localhost.
 */

export type ApiSide = 'server' | 'browser';

export function resolveApiOrigin(input: {
  side: ApiSide;
  env: { API_URL?: string; NEXT_PUBLIC_API_URL?: string };
  nodeEnv: string | undefined;
}): string {
  const { side, env, nodeEnv } = input;
  // Chuỗi rỗng là "không khai" — cùng lý do parseEnv của API strip chuỗi rỗng
  // (CLAUDE.md §Gotchas: nền tảng deploy gửi "" khi ô bị bỏ trống).
  const raw = side === 'server' ? env.API_URL || env.NEXT_PUBLIC_API_URL : env.NEXT_PUBLIC_API_URL;
  if (raw) return raw.replace(/\/+$/, '');
  // Production thiếu là lỗi cấu hình PHẢI nổ ngay (gương parseEnv fail-fast
  // của API) — rơi về localhost là ship một app câm lặng bắn nhầm chỗ.
  if (nodeEnv === 'production') {
    throw new Error(
      side === 'server'
        ? 'Missing API origin: set API_URL or NEXT_PUBLIC_API_URL in production'
        : 'Missing API origin: set NEXT_PUBLIC_API_URL in production (browser only sees NEXT_PUBLIC_*)',
    );
  }
  return 'http://localhost:3001';
}

/** Origin API cho code chạy PHÍA SERVER (SSR/ISR/route handler). */
export function serverApiOrigin(): string {
  return resolveApiOrigin({
    side: 'server',
    env: {
      API_URL: process.env.API_URL,
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    },
    nodeEnv: process.env.NODE_ENV,
  });
}

/** Origin API cho code chạy TRONG BROWSER — chỉ thấy NEXT_PUBLIC_*. */
export function browserApiOrigin(): string {
  return resolveApiOrigin({
    side: 'browser',
    // Viết literal process.env.NEXT_PUBLIC_API_URL để Next inline được vào
    // bundle browser — đọc gián tiếp qua biến là mất giá trị.
    env: { NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL },
    nodeEnv: process.env.NODE_ENV,
  });
}

/** Origin API cho code đang chạy — chọn phía theo `typeof window`. */
export function apiOrigin(): string {
  return typeof window === 'undefined' ? serverApiOrigin() : browserApiOrigin();
}
