import { isAdminAppRole } from '@tourism/contract/admin-access';
import { safeRedirect } from './safe-redirect';

/**
 * Cổng admin (spec P4a §2, ADR-0026 §2) — hàm THUẦN quyết định cho cả
 * proxy lẫn layout: session × role × path → allow / login / deny.
 * Fail-closed (ADR-0003): role không phải ADMIN (Owner) hay STAFF (ADR-0052)
 * — kể cả rỗng hay lạ — đều deny; chỉ hai path public được qua khi chưa đăng nhập.
 */

/** Subset session mà cổng cần — chỉ role; null = chưa đăng nhập. */
export interface GateSession {
  role: string;
}

export type GateDecision =
  | { kind: 'allow' }
  | { kind: 'login'; redirectTo: string }
  | { kind: 'deny' };

/**
 * Path không cần session: trang login, màn từ chối quyền, `/robots.txt`
 * (W3-H3 — crawler không có cookie; bị đá về /login là file disallow không
 * bao giờ được đọc, noindex chỉ còn mỗi lớp X-Robots-Tag), và hai route icon
 * sinh từ `app/icon.tsx` + `app/apple-icon.tsx` — thiếu chúng thì trình duyệt
 * xin favicon lúc chưa đăng nhập nhận về redirect /login, tab trang login mất icon.
 */
const PUBLIC_PATHS = ['/login', '/not-authorized', '/robots.txt', '/icon', '/apple-icon'] as const;

export function decideAdminAccess(session: GateSession | null, path: string): GateDecision {
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
  if (isPublic) return { kind: 'allow' };
  if (!session) return { kind: 'login', redirectTo: path };
  if (!isAdminAppRole(session.role)) return { kind: 'deny' };
  return { kind: 'allow' };
}

/**
 * Đích của trang login khi người vào ĐÃ có phiên (review max G40 Phần 3): phiên vào được app (Owner
 * hoặc Staff, ADR-0052) thì đi thẳng tới `?redirect=` (qua `safeRedirect`, cùng luật với form), còn
 * lại `null` = hiện form. Phiên khách vẫn thấy form — đó là lối đăng nhập lại bằng tài khoản admin.
 * Đích là trang chỉ Owner thì Staff về `/not-authorized` ở layout, như mọi lối vào khác.
 *
 * Vì sao cần: link mã đơn trong file Excel. Office tự tải URL trước khi mở trình duyệt, KHÔNG mang
 * cookie của trình duyệt, nên proxy trả về `/login?redirect=…` và trình duyệt mở đúng URL login ấy —
 * admin đang đăng nhập vẫn bị bắt điền form. Đích là chính trang login thì về trang chủ, không vòng lặp.
 */
export function loginDestination(session: GateSession | null, rawRedirect: unknown): string | null {
  if (!session || !isAdminAppRole(session.role)) return null;
  const target = safeRedirect(rawRedirect);
  const path = target.split(/[?#]/, 1)[0] ?? target;
  return path === '/login' || path.startsWith('/login/') ? '/' : target;
}

/**
 * Trang `/not-authorized` nói theo role (plan P4f, quyết định 5): Staff tới đó vì một trang
 * chỉ Owner, nên câu "tài khoản không có quyền admin" sai với họ.
 */
export function notAuthorizedVariant(role: string | null): 'ownerOnly' | 'noAccess' {
  return role === 'STAFF' ? 'ownerOnly' : 'noAccess';
}
