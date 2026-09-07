/**
 * Nguồn env DUY NHẤT cho origin API (cùng nếp ADR-0016 §6 của web — Nexora
 * từng lặp base-URL ở 8 file). Giá trị là ORIGIN TRẦN, không kèm /api.
 *
 * W3 (ADR-0026 AMEND 3 §D): admin forward cookie phiên theo MỌI request
 * server-side, nên origin sai là exfiltrate cookie admin — parse bằng
 * `new URL()`, production ép `https:`. Vòng vá review W3 (AMEND 4): tách
 * PHÍA như web — `API_URL` chỉ có nghĩa phía server, browser (Better Auth
 * client) và CSP `connect-src` (proxy) CHỈ dùng `NEXT_PUBLIC_API_URL`;
 * production thiếu biến → throw NÊU TÊN BIẾN (trước đây rơi về localhost rồi
 * mới chết ở phép ép https, message nói "must use https" che mất nguyên nhân
 * thật). Phép kiểm chạy "lúc gọi": `next.config.ts` gọi một lần lúc build
 * để lỗi env nổ ồn ào ở build thay vì im lặng ở runtime.
 */

export type ApiSide = 'server' | 'browser';

/** localhost / 127.0.0.1 / ::1 — chỉ có ở máy dev, CI và `next start` thử tay. */
function isLoopback(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

export function resolveApiOrigin(input: {
  side: ApiSide;
  env: { API_URL?: string; NEXT_PUBLIC_API_URL?: string };
  nodeEnv: string | undefined;
}): string {
  const { side, env, nodeEnv } = input;
  const production = nodeEnv === 'production';
  const varsHint = side === 'server' ? 'API_URL/NEXT_PUBLIC_API_URL' : 'NEXT_PUBLIC_API_URL';
  // Chuỗi rỗng là "không khai" — nền tảng deploy gửi "" khi ô bị bỏ trống
  // (CLAUDE.md §Gotchas).
  const raw = side === 'server' ? env.API_URL || env.NEXT_PUBLIC_API_URL : env.NEXT_PUBLIC_API_URL;
  if (!raw) {
    if (production) throw new Error(`Missing API origin: set ${varsHint} in production`);
    return 'http://localhost:3001';
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid API origin "${raw}" — check ${varsHint}`);
  }
  // Ép https ở production TRỪ loopback: `next build` nào cũng NODE_ENV=production
  // mà CI/gate local build với API tạm http://localhost:3001 (công thức CI),
  // và `next start` nghiệm thu local cũng vậy — loopback là môi trường thử,
  // không phải deploy; origin http tới host thật mới là lỗi cấu hình.
  if (production && url.protocol !== 'https:' && !isLoopback(url.hostname)) {
    throw new Error(
      `API origin must use https in production, got "${url.protocol}//" — check ${varsHint}`,
    );
  }
  // url.origin chuẩn hoá luôn dấu / cuối và mọi path thừa.
  return url.origin;
}

/** Origin API cho code chạy PHÍA SERVER (server component, action, route). */
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

/**
 * Origin API mà BROWSER gọi (Better Auth client) — cũng là nguồn DUY NHẤT
 * cho `connect-src` của CSP admin (proxy.ts): hai chỗ đọc hai kiểu từng làm
 * CSP nhận path thừa/localhost trong khi authClient gọi đúng origin.
 */
export function browserApiOrigin(): string {
  return resolveApiOrigin({
    side: 'browser',
    // Literal để Next inline được vào bundle browser.
    env: { NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL },
    nodeEnv: process.env.NODE_ENV,
  });
}

/** Origin API cho code đang chạy — chọn phía theo `typeof window`. Gọi LƯỜI, không ở module scope. */
export function apiOrigin(): string {
  return typeof window === 'undefined' ? serverApiOrigin() : browserApiOrigin();
}
