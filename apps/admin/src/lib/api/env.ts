/**
 * Nguồn env DUY NHẤT cho origin API (cùng nếp ADR-0016 §6 của web — Nexora
 * từng lặp base-URL ở 8 file). Giá trị là ORIGIN TRẦN, không kèm /api.
 *
 * W3 (ADR-0026 AMEND 3 §D): admin forward cookie phiên theo MỌI request
 * server-side, nên origin sai là exfiltrate cookie admin — parse bằng
 * `new URL()` (chuỗi rác chết ngay lúc boot thay vì fetch lỗi khó hiểu),
 * production ép `https:`. Hệ quả tự nhiên: production quên khai env → rơi
 * về localhost http cũng chết ở phép ép https — fail-fast trọn gói.
 */
export function resolveApiOrigin(input: {
  env: { API_URL?: string; NEXT_PUBLIC_API_URL?: string };
  nodeEnv: string | undefined;
}): string {
  const { env, nodeEnv } = input;
  // Chuỗi rỗng là "không khai" — nền tảng deploy gửi "" khi ô bị bỏ trống
  // (CLAUDE.md §Gotchas).
  const raw = env.API_URL || env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
  const url = new URL(raw);
  if (nodeEnv === 'production' && url.protocol !== 'https:') {
    throw new Error(
      `API origin must use https in production, got "${url.protocol}//" — check API_URL/NEXT_PUBLIC_API_URL`,
    );
  }
  // url.origin chuẩn hoá luôn dấu / cuối và mọi path thừa.
  return url.origin;
}

/** Origin API cho code đang chạy (server ưu tiên API_URL; browser chỉ thấy NEXT_PUBLIC_*). */
export function apiOrigin(): string {
  return resolveApiOrigin({
    env: {
      API_URL: process.env.API_URL,
      NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    },
    nodeEnv: process.env.NODE_ENV,
  });
}
