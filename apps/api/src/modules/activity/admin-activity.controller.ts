import { Controller } from '@nestjs/common';
import { implement } from '@orpc/nest';
import { ORPCError } from '@orpc/server';
import { contract } from '@tourism/contract';
import { AdminImplement } from '../../auth/admin-implement.decorator.js';
import type { SessionUser } from '../../auth/auth.config.js';
import { CurrentUser } from '../../auth/current-user.decorator.js';
import { Roles } from '../../auth/roles.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { ActivityService } from './activity.service.js';
import { actorFromSession } from './activity-recorder.js';

/**
 * Nhật ký thao tác admin (ADR-0061). `list` là `owner`, `recordExport` là `staff` trong
 * `ADMIN_ACCESS`; `@AdminImplement` suy `@Roles` từ bảng, `@Roles(ADMIN)` cấp class là lưới.
 * Cả hai là `skip` trong `ADMIN_ACTIVITY` — nhật ký không tự ghi chính nó. Người làm lấy từ PHIÊN.
 */
@Controller()
@Roles(UserRole.ADMIN)
export class AdminActivityController {
  constructor(private readonly activity: ActivityService) {}

  @AdminImplement(contract.admin.activity.list)
  list() {
    return implement(contract.admin.activity.list).handler(({ input }) =>
      this.activity.list(input),
    );
  }

  @AdminImplement(contract.admin.activity.recordExport)
  recordExport(@CurrentUser() user: SessionUser) {
    return implement(contract.admin.activity.recordExport).handler(({ input }) => {
      const actor = actorFromSession(user);
      // Lưới: `@AdminImplement` đã chỉ cho ADMIN và STAFF vào.
      if (!actor) throw new ORPCError('FORBIDDEN');
      return this.activity.recordExport(actor, input);
    });
  }
}
