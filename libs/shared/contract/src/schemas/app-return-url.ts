import { z } from 'zod';

/**
 * Luật DUY NHẤT về URL app mà cổng thanh toán được phép trả khách về (ADR-0062) — API kiểm lúc
 * nhận input, trang chuyển tiếp của web kiểm lại trước khi chuyển (không tin query string).
 *
 * - `nexora://…`: scheme của bản build EAS — luôn được.
 * - `exp://` / `exps://` với host là loopback hoặc IPv4 mạng riêng: URL Expo Go của vòng dev.
 *   Chặn host công khai để link chuyển tiếp không mở được bundle Expo từ máy lạ.
 */
// Tự tách bằng regex thay vì `URL`: contract chạy ở cả API, web lẫn mobile, và tsconfig của nó
// không nạp kiểu DOM/Node nên `URL` không có sẵn. Khoảng trắng hay ký tự điều khiển bị chặn trước.
const APP_URL = /^nexora:\/\/[^\s]*$/;
const EXPO_URL = /^exps?:\/\/([^/?#:@\s]+)(?::\d{1,5})?(?:[/?#][^\s]*)?$/;

function isPrivateHost(hostname: string): boolean {
  if (hostname === 'localhost') return true;
  const parts = hostname.split('.');
  if (parts.length !== 4 || parts.some((p) => !/^\d{1,3}$/.test(p))) return false;
  const octets = parts.map(Number);
  if (octets.some((n) => n > 255)) return false;
  const [a = 0, b = 0] = octets;
  return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

export function isAllowedAppReturnUrl(value: string): boolean {
  if (APP_URL.test(value)) return true;
  const expo = EXPO_URL.exec(value);
  return expo?.[1] !== undefined && isPrivateHost(expo[1]);
}

export const AppReturnUrlSchema = z
  .string()
  .max(512)
  .refine(isAllowedAppReturnUrl, { message: 'Unsupported app return URL' });

/** Gắn mã đơn và kết quả cổng vào URL app — trang chuyển tiếp của web gọi trước khi chuyển. */
export function withAppReturnParams(
  appUrl: string,
  code: string,
  status: 'success' | 'cancelled',
): string {
  const separator = appUrl.includes('?') ? '&' : '?';
  return `${appUrl}${separator}code=${encodeURIComponent(code)}&status=${status}`;
}
