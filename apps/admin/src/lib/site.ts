/**
 * Địa chỉ site khách (www) mà admin LINK sang — một nguồn cho mọi chỗ: trang đăng nhập,
 * not-authorized, menu người dùng, phần đầu khu sửa tour và bài viết, link trong bản xem trước
 * markdown.
 *
 * Đọc `NEXT_PUBLIC_WEB_URL` (G19), cùng tên với `EXPO_PUBLIC_WEB_URL` của mobile. BẪY TÊN:
 * `NEXT_PUBLIC_SITE_URL` của admin là origin CỦA CHÍNH admin, không phải của web.
 *
 * Không khai thì:
 * - production: origin thật. Bản deploy trên Vercel chưa có biến này, và thiếu nó không được làm
 *   sai link nào. Khác origin API (`api/env.ts`): thiếu API là login chết, nên ở đó production
 *   THIẾU là build đỏ;
 * - dev và test: web local ở cổng mặc định của `next dev`. Trước G19 origin là hằng cứng của
 *   prod, nên "View on site" ở máy dev mở trang prod: 404, hoặc một tour khác cùng slug.
 *
 * Gọi LƯỜI, cùng luật `api/env.ts`: giá trị hỏng thì ném lúc gọi chứ không lúc nạp module, và
 * `next.config.ts` gọi một lần để build đỏ sớm.
 */
const PRODUCTION_WEB_ORIGIN = 'https://www.nexora-travel.agency';
const DEV_WEB_ORIGIN = 'http://localhost:3000';

export function resolveWebOrigin(input: {
  raw: string | undefined;
  nodeEnv: string | undefined;
}): string {
  const { raw, nodeEnv } = input;
  // Chuỗi rỗng là "không khai" — nền tảng deploy gửi "" khi ô bị bỏ trống (CLAUDE.md §Gotchas).
  if (!raw) return nodeEnv === 'production' ? PRODUCTION_WEB_ORIGIN : DEV_WEB_ORIGIN;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid web origin "${raw}" — check NEXT_PUBLIC_WEB_URL`);
  }
  // Thiếu scheme thì `URL` đọc "localhost:" thành scheme, và scheme lạ cho origin 'null' — một
  // link 'null/tours/...' hỏng âm thầm. Chỉ nhận http(s).
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Web origin must be http(s), got "${raw}" — check NEXT_PUBLIC_WEB_URL`);
  }
  // `origin` chuẩn hoá luôn dấu / cuối và mọi path thừa.
  return url.origin;
}

/** Origin site khách cho code đang chạy, phía server lẫn browser. */
export function webUrl(): string {
  return resolveWebOrigin({
    // Literal để Next inline được vào bundle browser.
    raw: process.env.NEXT_PUBLIC_WEB_URL,
    nodeEnv: process.env.NODE_ENV,
  });
}

/** Trang tour trên site khách — chỉ mở được khi tour đang bán (tắt bán thì 404). */
export function tourPageUrl(slug: string): string {
  return `${webUrl()}/tours/${encodeURIComponent(slug)}`;
}

/** Trang bài trên site khách — chỉ mở được khi bài đã đăng (nháp và bài hẹn giờ là 404). */
export function postPageUrl(slug: string): string {
  return `${webUrl()}/blog/${encodeURIComponent(slug)}`;
}
