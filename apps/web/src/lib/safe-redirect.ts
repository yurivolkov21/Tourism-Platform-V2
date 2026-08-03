/** Chống open-redirect (port ngữ nghĩa safe-redirect.ts của Nexora):
    chỉ nhận path local một dấu `/` đầu, còn lại về fallback. */
export function safeRedirect(raw: unknown, fallback = '/'): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 512) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
  if (raw.includes('\\')) return fallback;
  // Ký tự điều khiển (newline, carriage-return, tab, NUL…) — so mã ký tự
  // trực tiếp (code <= 31) thay vì viết escape unicode thô vào source, tránh
  // rủi ro pipeline giải mã escape thành byte điều khiển thật.
  for (let i = 0; i < raw.length; i += 1) {
    if (raw.charCodeAt(i) <= 31) return fallback;
  }
  return raw;
}
