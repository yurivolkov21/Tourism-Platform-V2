import { Controller } from '@nestjs/common';
import { implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import { AdminImplement } from '../../auth/admin-implement.decorator.js';
import { Roles } from '../../auth/roles.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import {
  AdminPaymentEventsService,
  PaymentEventNotFoundError,
} from './admin-payment-events.service.js';

/**
 * Bề mặt payment events cho admin (spec P4c §3-F8). Cùng cách ghép guard như
 * AdminOutboxController: `@Roles(ADMIN)` cấp class là lưới; quyền thật của từng handler do
 * `@AdminImplement` suy từ bảng `ADMIN_ACCESS` (ADR-0052) — ẩn danh → 401, khách → 403,
 * Staff → 403 ở thủ tục chỉ Owner, cả hai TRƯỚC khi oRPC parse input.
 *
 * Tách khỏi `WebhooksController` (cùng module): controller kia là route Nest
 * thuần `@Public()` nhận raw body từ provider; trộn một procedure oRPC có
 * guard vào đó là để hai mô hình auth ngược nhau sống chung một class.
 */
@Controller()
@Roles(UserRole.ADMIN)
export class AdminPaymentEventsController {
  constructor(private readonly events: AdminPaymentEventsService) {}

  @AdminImplement(contract.admin.paymentEvents.list)
  list() {
    return implement(contract.admin.paymentEvents.list).handler(({ input }) =>
      this.events.list(input),
    );
  }

  @AdminImplement(contract.admin.paymentEvents.byId)
  byId() {
    return implement(contract.admin.paymentEvents.byId).handler(async ({ input, errors }) => {
      try {
        return await this.events.byId(input.id);
      } catch (error) {
        // Message của CONTRACT (nếp F7): admin đọc copy i18n theo mã.
        if (error instanceof PaymentEventNotFoundError) throw errors.NOT_FOUND();
        throw error;
      }
    });
  }
}
