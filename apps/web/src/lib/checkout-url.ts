/**
 * Guard scheme cho checkoutUrl TRƯỚC window.location.assign (W3-O4, audit
 * cụm 7): URL này do API trả về từ Stripe/PayPal — bình thường luôn https,
 * nhưng đường đi qua network/log/response có thể bị nhiễm, và assign một
 * chuỗi `javascript:` là XSS trọn gói. Chặn ở CHỖ DÙNG vì đây là sink duy
 * nhất điều hướng bằng dữ liệu từ ngoài.
 *
 * http://localhost chỉ qua NGOÀI production — Stripe CLI/dev sandbox nội bộ.
 */
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1']);

export function isCheckoutUrl(
  url: string,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol === 'https:') return true;
  return (
    parsed.protocol === 'http:' && nodeEnv !== 'production' && LOCAL_HOSTNAMES.has(parsed.hostname)
  );
}
