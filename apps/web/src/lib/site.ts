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

// Gốc URL công khai của web: RSS, sitemap, robots (so host để mở crawl) và
// từ W3 là `metadataBase` — canonical/OG của MỌI trang. Dev chưa đặt thì rơi
// về localhost; production THIẾU là throw (vòng vá review W3, ADR-0016
// AMEND 2): trước W3 canonical tương đối vô hại, sau W3 thiếu env là
// canonical `http://localhost:3000/...` toàn site — Google hạ cả catalogue mà
// không đèn nào đỏ. Gương `resolveApiOrigin`: nêu tên biến trong message.
const FALLBACK = 'http://localhost:3000';

/** Thuần để test: production thiếu → throw; còn lại cắt / cuối, rỗng → fallback. */
export function resolveSiteUrl(env: { NEXT_PUBLIC_SITE_URL?: string; NODE_ENV?: string }): string {
  const raw = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (raw && raw.length > 0) return raw.replace(/\/+$/, '');
  if (env.NODE_ENV === 'production') {
    throw new Error(
      'Missing NEXT_PUBLIC_SITE_URL in production — metadataBase/canonical would point at localhost',
    );
  }
  return FALLBACK;
}

export function siteUrl(): string {
  return resolveSiteUrl({
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NODE_ENV: process.env.NODE_ENV,
  });
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
