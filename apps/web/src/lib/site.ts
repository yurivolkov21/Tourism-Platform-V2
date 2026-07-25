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
