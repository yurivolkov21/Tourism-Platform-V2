/**
 * Địa chỉ site khách (www). Admin chỉ LINK sang — một bản cho mọi chỗ: trang đăng
 * nhập, not-authorized, menu người dùng, phần đầu khu sửa tour.
 */
export const SITE_URL = 'https://www.nexora-travel.agency';

/** Trang tour trên site khách — chỉ mở được khi tour đang bán (tắt bán thì 404). */
export function tourPageUrl(slug: string): string {
  return `${SITE_URL}/tours/${encodeURIComponent(slug)}`;
}
