/**
 * Nguồn env DUY NHẤT cho origin API (cùng nếp ADR-0016 §6 của web — Nexora
 * từng lặp base-URL ở 8 file). Giá trị là ORIGIN TRẦN, không kèm /api.
 */
export function resolveApiOrigin(env: { API_URL?: string; NEXT_PUBLIC_API_URL?: string }): string {
  // Chuỗi rỗng là "không khai" — nền tảng deploy gửi "" khi ô bị bỏ trống
  // (CLAUDE.md §Gotchas).
  const raw = env.API_URL || env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  return raw.replace(/\/+$/, '');
}

/** Origin API cho code đang chạy (server ưu tiên API_URL; browser chỉ thấy NEXT_PUBLIC_*). */
export function apiOrigin(): string {
  return resolveApiOrigin({
    API_URL: process.env.API_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  });
}
