import { Controller } from '@nestjs/common';
import { implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import { AdminImplement } from '../../auth/admin-implement.decorator.js';
import type { SessionUser } from '../../auth/auth.config.js';
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
 * AdminBookingsController: `@Roles(ADMIN)` cấp class là lưới; quyền thật của từng handler do
 * `@AdminImplement` suy từ bảng `ADMIN_ACCESS` (ADR-0052) — ẩn danh → 401, khách → 403,
 * Staff → 403 ở thủ tục chỉ Owner, cả hai TRƯỚC khi oRPC parse input.
 */
@Controller()
@Roles(UserRole.ADMIN)
export class AdminOutboxController {
  constructor(private readonly outbox: AdminOutboxService) {}

  @AdminImplement(contract.admin.outbox.list)
  list() {
    return implement(contract.admin.outbox.list).handler(({ input }) => this.outbox.list(input));
  }

  @AdminImplement(contract.admin.outbox.retry)
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
