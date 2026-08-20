/** Chống open-redirect — port nguyên hàm đã test của apps/web (cùng ngữ
    nghĩa safe-redirect.ts của Nexora): chỉ nhận path local một dấu `/` đầu. */
export function safeRedirect(raw: unknown, fallback = '/'): string {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 512) return fallback;
  if (!raw.startsWith('/') || raw.startsWith('//')) return fallback;
  if (raw.includes('\\')) return fallback;
  // Ký tự điều khiển (newline/CR/tab/NUL…) — so mã trực tiếp, cùng lý do web.
  for (let i = 0; i < raw.length; i += 1) {
    if (raw.charCodeAt(i) <= 31) return fallback;
  }
  return raw;
}
