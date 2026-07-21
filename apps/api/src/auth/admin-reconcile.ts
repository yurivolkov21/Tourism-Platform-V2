import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { adminEmails } from '../config/env.js';
import { UserRole } from '../generated/prisma/enums.js';
import { prisma } from './auth.config.js';

/**
 * Promote user hiện có thỏa (emailVerified ∧ email ∈ ADMIN_EMAILS) mà chưa ADMIN.
 * Promote-only — KHÔNG BAO GIỜ demote (spec §5). Trả về số row được promote.
 * (AUTH-1 self-heal, ADR-0008). `email` là citext nên match không phân biệt hoa/thường.
 */
export async function reconcileAdmins(
  client: typeof prisma,
  emails: readonly string[],
): Promise<number> {
  if (emails.length === 0) return 0;
  const { count } = await client.user.updateMany({
    where: { email: { in: [...emails] }, emailVerified: true, role: { not: UserRole.ADMIN } },
    data: { role: UserRole.ADMIN },
  });
  return count;
}

/**
 * Chạy reconcile một lần lúc app khởi động — self-heal khi email được thêm vào
 * ADMIN_EMAILS SAU khi account đã verified (AUTH-1), và backstop cho
 * `emailVerification.afterEmailVerification` (nếu lỡ fire).
 */
@Injectable()
export class AdminReconcileService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminReconcileService.name);

  async onApplicationBootstrap(): Promise<void> {
    const n = await reconcileAdmins(prisma, adminEmails);
    if (n > 0) this.logger.log(`Reconcile: promote ${n} admin theo ADMIN_EMAILS`);
  }
}
