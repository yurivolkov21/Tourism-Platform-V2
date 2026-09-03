import { Controller, UseGuards } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import type { SessionUser } from '../../auth/auth.config.js';
import { AuthGuard } from '../../auth/auth.guard.js';
import { CurrentUser } from '../../auth/current-user.decorator.js';
import { Roles } from '../../auth/roles.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import {
  AdminSubscribersService,
  SubscriberAlreadyUnsubscribedError,
  SubscriberNotFoundError,
} from './admin-subscribers.service.js';

/**
 * Bề mặt subscribers cho admin (spec P4c §3-F10). Cùng cách ghép guard như
 * `AdminEnquiriesController`: `@Roles(ADMIN)` ở cấp class được AuthGuard đọc
 * — ẩn danh → 401, không phải admin → 403, cả hai TRƯỚC khi oRPC parse input
 * (nên một request không quyền không bao giờ chạm tới bảng, kể cả để đọc).
 *
 * Controller RIÊNG chứ không thêm handler vào `NewsletterController`: cái đó
 * mang `@Public()` ở cấp CLASS cho ba endpoint của khách, và một handler
 * admin sống chung trong đó sẽ thừa kế đúng decorator vô hiệu hoá guard —
 * kiểu lỗi mà không dòng code nào nhìn ra được, chỉ int test bắt.
 *
 * Handler ghi lấy danh tính từ `@CurrentUser()` chứ không từ input: ai gỡ một
 * địa chỉ khỏi danh sách là chuyện của PHIÊN, không phải của body.
 */
@Controller()
@UseGuards(AuthGuard)
@Roles(UserRole.ADMIN)
export class AdminSubscribersController {
  constructor(private readonly subscribers: AdminSubscribersService) {}

  @Implement(contract.admin.subscribers.list)
  list() {
    return implement(contract.admin.subscribers.list).handler(({ input }) =>
      this.subscribers.list(input),
    );
  }

  @Implement(contract.admin.subscribers.unsubscribe)
  unsubscribe(@CurrentUser() user: SessionUser) {
    return implement(contract.admin.subscribers.unsubscribe).handler(async ({ input, errors }) => {
      try {
        return await this.subscribers.unsubscribe({ id: user.id }, input);
      } catch (error) {
        if (error instanceof SubscriberNotFoundError) throw errors.NOT_FOUND();
        if (error instanceof SubscriberAlreadyUnsubscribedError) {
          throw errors.ALREADY_UNSUBSCRIBED();
        }
        throw error;
      }
    });
  }
}
