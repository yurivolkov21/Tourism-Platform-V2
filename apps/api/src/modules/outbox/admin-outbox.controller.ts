import { Controller, UseGuards } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import type { SessionUser } from '../../auth/auth.config.js';
import { AuthGuard } from '../../auth/auth.guard.js';
import { CurrentUser } from '../../auth/current-user.decorator.js';
import { Roles } from '../../auth/roles.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import {
  AdminOutboxService,
  OutboxRowNotFailedError,
  OutboxRowNotFoundError,
} from './admin-outbox.service.js';

/**
 * Bề mặt outbox cho admin (spec P4c §3-F7). Cùng cách ghép guard như
 * AdminCancellationsController: `@Roles(ADMIN)` ở cấp class được AuthGuard
 * đọc — ẩn danh → 401, không phải admin → 403, cả hai TRƯỚC khi oRPC parse
 * input.
 */
@Controller()
@UseGuards(AuthGuard)
@Roles(UserRole.ADMIN)
export class AdminOutboxController {
  constructor(private readonly outbox: AdminOutboxService) {}

  @Implement(contract.admin.outbox.list)
  list() {
    return implement(contract.admin.outbox.list).handler(({ input }) => this.outbox.list(input));
  }

  @Implement(contract.admin.outbox.retry)
  retry(@CurrentUser() user: SessionUser) {
    return implement(contract.admin.outbox.retry).handler(async ({ input, errors }) => {
      try {
        return await this.outbox.retry(user.id, input.id);
      } catch (error) {
        if (error instanceof OutboxRowNotFoundError) throw errors.NOT_FOUND();
        // Message của CONTRACT, không phải câu service ghép (vòng vá review
        // F7): admin đọc copy i18n theo mã, còn tài liệu API phải khớp thứ
        // thật sự phát ra. Trạng thái thật nằm trong log nếu cần điều tra.
        if (error instanceof OutboxRowNotFailedError) throw errors.NOT_FAILED();
        throw error;
      }
    });
  }
}
