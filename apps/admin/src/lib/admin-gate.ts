/**
 * Cổng admin (spec P4a §2, ADR-0026 §2) — hàm THUẦN quyết định cho cả
 * proxy lẫn layout: session × role × path → allow / login / deny.
 * Fail-closed (ADR-0003): role không phải 'ADMIN' — kể cả rỗng hay lạ —
 * đều deny; chỉ hai path public được qua khi chưa đăng nhập.
 */

/** Subset session mà cổng cần — chỉ role; null = chưa đăng nhập. */
export interface GateSession {
  role: string;
}

export type GateDecision =
  | { kind: 'allow' }
  | { kind: 'login'; redirectTo: string }
  | { kind: 'deny' };

/** Path không cần session: trang login và màn từ chối quyền. */
const PUBLIC_PATHS = ['/login', '/not-authorized'] as const;

export function decideAdminAccess(session: GateSession | null, path: string): GateDecision {
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
  if (isPublic) return { kind: 'allow' };
  if (!session) return { kind: 'login', redirectTo: path };
  if (session.role !== 'ADMIN') return { kind: 'deny' };
  return { kind: 'allow' };
}
