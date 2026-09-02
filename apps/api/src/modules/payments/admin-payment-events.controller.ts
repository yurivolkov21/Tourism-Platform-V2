import { Controller, UseGuards } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import { AuthGuard } from '../../auth/auth.guard.js';
import { Roles } from '../../auth/roles.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import {
  AdminPaymentEventsService,
  PaymentEventNotFoundError,
} from './admin-payment-events.service.js';

/**
 * Bề mặt payment events cho admin (spec P4c §3-F8). Cùng cách ghép guard như
 * AdminOutboxController: `@Roles(ADMIN)` ở cấp class được AuthGuard đọc —
 * ẩn danh → 401, không phải admin → 403, cả hai TRƯỚC khi oRPC parse input.
 *
 * Tách khỏi `WebhooksController` (cùng module): controller kia là route Nest
 * thuần `@Public()` nhận raw body từ provider; trộn một procedure oRPC có
 * guard vào đó là để hai mô hình auth ngược nhau sống chung một class.
 */
@Controller()
@UseGuards(AuthGuard)
@Roles(UserRole.ADMIN)
export class AdminPaymentEventsController {
  constructor(private readonly events: AdminPaymentEventsService) {}

  @Implement(contract.admin.paymentEvents.list)
  list() {
    return implement(contract.admin.paymentEvents.list).handler(({ input }) =>
      this.events.list(input),
    );
  }

  @Implement(contract.admin.paymentEvents.byId)
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
