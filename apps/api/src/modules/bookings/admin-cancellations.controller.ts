import { Controller, UseGuards } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import type { SessionUser } from '../../auth/auth.config.js';
import { AuthGuard } from '../../auth/auth.guard.js';
import { CurrentUser } from '../../auth/current-user.decorator.js';
import { Roles } from '../../auth/roles.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import {
  CancellationAlreadyDecidedError,
  CancellationRequestNotFoundError,
  CancellationsService,
} from './cancellations.service.js';
import { RefundNothingLeftError } from './refund-math.js';
import { BookingNotRefundableError, ProviderRefundFailedError } from './refunds.service.js';

/**
 * Admin cancellation queue (spec P2 W4). Same guard composition as
 * AdminBookingsController: class-level `@Roles(ADMIN)` read by AuthGuard —
 * anonymous → 401, non-admin → 403, both before oRPC parses input.
 */
@Controller()
@UseGuards(AuthGuard)
@Roles(UserRole.ADMIN)
export class AdminCancellationsController {
  constructor(private readonly cancellations: CancellationsService) {}

  @Implement(contract.admin.cancellations.list)
  list() {
    return implement(contract.admin.cancellations.list).handler(({ input }) =>
      this.cancellations.adminList(input),
    );
  }

  @Implement(contract.admin.cancellations.decide)
  decide(@CurrentUser() user: SessionUser) {
    return implement(contract.admin.cancellations.decide).handler(async ({ input, errors }) => {
      try {
        return await this.cancellations.decide(user.id, input.id, {
          approve: input.approve,
          ...(input.decisionNote !== undefined ? { decisionNote: input.decisionNote } : {}),
        });
      } catch (error) {
        if (error instanceof CancellationRequestNotFoundError) throw errors.NOT_FOUND();
        if (error instanceof CancellationAlreadyDecidedError) {
          throw errors.ALREADY_DECIDED({ message: error.message });
        }
        // Approve-only gates: no refundable remainder / captured payment
        // (incl. a booking already settled through W3 while the request sat
        // open — the admin denies such a request instead).
        if (error instanceof BookingNotRefundableError || error instanceof RefundNothingLeftError) {
          throw errors.NOT_REFUNDABLE({ message: error.message });
        }
        if (error instanceof ProviderRefundFailedError) {
          throw errors.REFUND_FAILED({ message: error.message });
        }
        throw error;
      }
    });
  }
}
