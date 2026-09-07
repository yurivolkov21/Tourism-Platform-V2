/**
 * Nguồn env DUY NHẤT của tầng dữ liệu web (ADR-0016 §6 + AMEND 1/2) — Nexora
 * lặp base-URL thủ công ở 8 file, đây là chỗ sửa bài học đó. Giá trị là
 * ORIGIN TRẦN (không kèm /api): path đã nằm trong contract.
 *
 * Origin theo PHÍA (audit 05/09 cụm 7): `API_URL` CHỈ có nghĩa phía server —
 * Next chỉ inline `NEXT_PUBLIC_*` vào bundle browser, nên nhánh `API_URL`
 * trong browser không bao giờ tồn tại; cấu hình "API_URL riêng cho server"
 * từng làm SSR xanh còn MỌI nút ghi từ browser bắn về fallback localhost.
 *
 * Chuẩn hoá bằng `new URL().origin` (vòng vá review W3, ADR-0016 AMEND 2):
 * web forward cookie phiên server-side tới origin này (session.ts,
 * account.ts, withAuthOptions) nên origin sai là exfiltrate cookie — cùng lý
 * lẽ ADR-0026 §D của admin; và giá trị này chảy thẳng vào `connect-src` của
 * CSP, nơi một path thừa (`/api`) hay một dấu `;` là chặn mọi call hoặc cắt
 * đôi header. Production ép `https:` ở CẢ HAI phía.
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
  // Chuỗi rỗng là "không khai" — cùng lý do parseEnv của API strip chuỗi rỗng
  // (CLAUDE.md §Gotchas: nền tảng deploy gửi "" khi ô bị bỏ trống).
  const raw = side === 'server' ? env.API_URL || env.NEXT_PUBLIC_API_URL : env.NEXT_PUBLIC_API_URL;
  if (!raw) {
    // Production thiếu là lỗi cấu hình PHẢI nổ ngay (gương parseEnv fail-fast
    // của API) — rơi về localhost là ship một app câm lặng bắn nhầm chỗ.
    if (production) {
      throw new Error(
        side === 'server'
          ? 'Missing API origin: set API_URL or NEXT_PUBLIC_API_URL in production'
          : 'Missing API origin: set NEXT_PUBLIC_API_URL in production (browser only sees NEXT_PUBLIC_*)',
      );
    }
    return 'http://localhost:3001';
  }
  // Chuỗi rác chết ngay tại đây (message nêu tên biến) thay vì `fetch failed`
  // khó hiểu lúc prerender.
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(
      `Invalid API origin "${raw}" — check ${side === 'server' ? 'API_URL/NEXT_PUBLIC_API_URL' : 'NEXT_PUBLIC_API_URL'}`,
    );
  }
  // Ép https ở production TRỪ loopback: `next build` nào cũng NODE_ENV=production
  // mà CI/gate local build với API tạm http://localhost:3001 (công thức CI),
  // và `next start` nghiệm thu local cũng vậy — loopback là môi trường thử,
  // không phải deploy; origin http tới host thật mới là lỗi cấu hình.
  if (production && url.protocol !== 'https:' && !isLoopback(url.hostname)) {
    throw new Error(
      `API origin must use https in production, got "${url.protocol}//" — check ${side === 'server' ? 'API_URL/NEXT_PUBLIC_API_URL' : 'NEXT_PUBLIC_API_URL'}`,
    );
  }
  // .origin bỏ path/query/dấu / cuối — chỉ còn scheme://host[:port].
  return url.origin;
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

/**
 * Origin API cho code đang chạy — chọn phía theo `typeof window`. Gọi LƯỜI
 * (trong hàm/handler), KHÔNG ở module scope: `next build` nào cũng chạy
 * NODE_ENV=production nên phép fail-fast ở module scope là nổ lúc import
 * (prerender chết với stack ở client.ts, chunk browser nổ khi hydrate ngoài
 * cây render — error.tsx không bắt) thay vì "throw lúc gọi" như ADR-0016 §6.
 */
export function apiOrigin(): string {
  return typeof window === 'undefined' ? serverApiOrigin() : browserApiOrigin();
}
