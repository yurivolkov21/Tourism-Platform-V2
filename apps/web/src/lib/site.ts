// Kênh liên hệ chính thức — NGUỒN DUY NHẤT cho toàn site (topbar, section
// Contact trang chủ, ContactSplit /contact). Đặt ở module thường (KHÔNG
// 'use client') thay vì trong home/contact.tsx — đã thử export hằng từ đó rồi
// import vào top-bar.tsx thì `pnpm gate` (next build) vỡ ở bước prerender:
// `TypeError: <module>.PHONE.replace is not a function` trên MỌI trang tĩnh.
// Lý do: home/contact.tsx là 'use client' NHƯNG cũng export component
// <Contact/> mà `app/(site)/page.tsx` (Server Component) render trực tiếp —
// việc đó biến cả file thành ranh giới client-reference của Flight/RSC. TopBar
// nằm trong layout gốc (mọi route đều có), nên import hằng số qua ranh giới
// đó từ MỘT client component site-wide khác làm giá trị không còn đáng tin
// cậy lúc prerender (contact-split.tsx vẫn an toàn vì chỉ dùng ở một trang).
// Tách ra module thường này để mọi nơi import trực tiếp, không đụng ranh
// giới RSC nào cả — đã kiểm chứng lại bằng `next build` sau khi tách.
export const EMAIL = 'tourism.platform.online@gmail.com';
export const PHONE = '+84 24 3826 0126';

// Gốc URL công khai của web. Cần cho RSS (feed bắt buộc URL tuyệt đối) và
// sau này cho sitemap/robots. Đọc từ env; khi dev chưa đặt thì rơi về
// localhost để feed vẫn hợp lệ thay vì sinh link gãy.
const FALLBACK = 'http://localhost:3000';

export function siteUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  const base = raw && raw.length > 0 ? raw : FALLBACK;
  return base.replace(/\/+$/, '');
}

/** Ghép thành URL tuyệt đối; chấp nhận đường dẫn có hoặc không có `/` đầu. */
export function absoluteUrl(path: string): string {
  return `${siteUrl()}/${path.replace(/^\/+/, '')}`;
}

/** Thoát ký tự đặc biệt của XML. `&` phải đi TRƯỚC, không thì escape chồng. */
export function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
