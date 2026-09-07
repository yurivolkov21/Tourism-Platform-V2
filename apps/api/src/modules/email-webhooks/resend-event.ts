/**
 * Dịch một event Resend ĐÃ VERIFY chữ ký → danh sách suppression cần ghi
 * (W4 E6, ADR-0039 §4). Thuần, không chạm DB.
 *
 * Chỉ hai loại được ghi:
 * - `email.bounced` với bounce CỨNG (hoặc không khai loại — mặc định coi là
 *   cứng, phía an toàn cho reputation): địa chỉ không tồn tại, gửi tiếp là
 *   đốt uy tín domain. Soft bounce (hộp thư đầy, server bận) là sự cố TẠM —
 *   ghi nó là chặn vĩnh viễn một địa chỉ đang sống.
 * - `email.complained`: người nhận bấm "spam" — rút consent bằng hành động.
 *
 * Mọi loại khác (delivered/opened/clicked…) và body dị dạng → mảng rỗng,
 * không bao giờ throw: webhook đã verify thì luôn 2xx được, provider không
 * phải retry một event ta cố ý bỏ qua.
 */

export interface ResendSuppression {
  email: string;
  reason: 'bounced' | 'complained';
}

export function suppressionsFromResendEvent(body: unknown): ResendSuppression[] {
  if (typeof body !== 'object' || body === null) return [];
  const { type, data } = body as { type?: unknown; data?: unknown };
  if (typeof type !== 'string' || typeof data !== 'object' || data === null) return [];

  const reason: ResendSuppression['reason'] | null =
    type === 'email.bounced' ? 'bounced' : type === 'email.complained' ? 'complained' : null;
  if (!reason) return [];

  if (reason === 'bounced') {
    const bounce = (data as { bounce?: unknown }).bounce;
    const bounceType =
      typeof bounce === 'object' && bounce !== null
        ? (bounce as { type?: unknown }).type
        : undefined;
    if (typeof bounceType === 'string' && bounceType !== 'hard') return [];
  }

  const rawTo = (data as { to?: unknown }).to;
  const recipients = Array.isArray(rawTo) ? rawTo : typeof rawTo === 'string' ? [rawTo] : [];
  return recipients
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .map((email) => ({ email, reason }));
}
