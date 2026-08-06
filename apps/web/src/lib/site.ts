// Kênh liên hệ chính thức — NGUỒN DUY NHẤT cho toàn site (topbar, section
// Contact trang chủ, ContactSplit /contact). PHẢI nằm ở module thường như file
// này, KHÔNG được đặt trong một file có 'use client'.
//
// Lý do, đã đo bằng ba lần `next build`: `TopBar` là Server Component. Server
// Component import BẤT KỲ export nào từ module 'use client' thì nhận về
// client-reference proxy chứ không phải giá trị gốc — nên `PHONE` thành object
// và `PHONE.replace(...)` ném `TypeError` ở bước prerender, giết mọi trang
// tĩnh. Đã thử đặt hằng trong `home/contact.tsx` ('use client'): vỡ. Thử một
// module 'use client' rỗng chỉ có 2 hằng, không export component nào: vỡ y
// hệt — nên nguyên nhân KHÔNG phải là file đó có export component.
//
// `contact-split.tsx` đọc được hằng từ module 'use client' là vì CHÍNH NÓ có
// 'use client' (import client→client trả giá trị thật), không phải vì nó chỉ
// dùng ở một trang. Biến quyết định duy nhất: consumer nằm ở graph server hay
// graph client.
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
