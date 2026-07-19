import { Controller, UseGuards } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import type { SessionUser } from '../../auth/auth.config.js';
import { AuthGuard } from '../../auth/auth.guard.js';
import { CurrentUser } from '../../auth/current-user.decorator.js';
import { Roles } from '../../auth/roles.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { ReviewNotFoundError, ReviewsService } from './reviews.service.js';

/**
 * Bề mặt moderation review cho admin (spec P3a-A W1). Cùng cách ghép guard
 * như AdminBookingsController: ẩn danh → 401, không phải admin → 403, cả hai
 * trước khi oRPC parse bất kỳ input nào.
 */
@Controller()
@UseGuards(AuthGuard)
@Roles(UserRole.ADMIN)
export class AdminReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Implement(contract.admin.reviews.moderate)
  moderate(@CurrentUser() user: SessionUser) {
    return implement(contract.admin.reviews.moderate).handler(async ({ input, errors }) => {
      try {
        // moderate trả LUÔN shape admin (đọc trong transaction) — không cần
        // query lại sau đó.
        return await this.reviews.moderate(user.id, input);
      } catch (err) {
        if (err instanceof ReviewNotFoundError) throw errors.REVIEW_NOT_FOUND();
        throw err;
      }
    });
  }

  @Implement(contract.admin.reviews.list)
  list() {
    return implement(contract.admin.reviews.list).handler(({ input }) =>
      this.reviews.adminList(input),
    );
  }
}
