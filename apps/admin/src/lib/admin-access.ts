import { type AdminProcedureKey, canAccess } from '@tourism/contract/admin-access';
import { redirect } from 'next/navigation';

/**
 * Trang chỉ Owner (ADR-0052 §2): role không gọi được thủ tục chính của trang → về
 * `/not-authorized` TRƯỚC khi gọi API. Gọi ngay sau `getServerSession()` và trước mọi fetch
 * (plan P4f, quyết định 13) — fetch song song với phiên thì 403 nổ trước khi kịp chặn.
 */
export function requirePageAccess(session: { role: string }, key: AdminProcedureKey): void {
  if (!canAccess(session.role, key)) redirect('/not-authorized');
}
