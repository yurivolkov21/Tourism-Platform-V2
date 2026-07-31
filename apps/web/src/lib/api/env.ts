/**
 * Nguồn env DUY NHẤT của tầng dữ liệu web (ADR-0016 §6) — Nexora lặp base-URL
 * thủ công ở 8 file, đây là chỗ sửa bài học đó. Giá trị là ORIGIN TRẦN
 * (không kèm /api): path đã nằm trong contract.
 */
export function resolveApiOrigin(env: { API_URL?: string; NEXT_PUBLIC_API_URL?: string }): string {
  // Chuỗi rỗng là "không khai" — cùng lý do parseEnv của API strip chuỗi rỗng
  // (CLAUDE.md §Gotchas: nền tảng deploy gửi "" khi ô bị bỏ trống).
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
