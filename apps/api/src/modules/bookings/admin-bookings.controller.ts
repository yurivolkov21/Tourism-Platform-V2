import { Controller, UseGuards } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import type { SessionUser } from '../../auth/auth.config.js';
import { AuthGuard } from '../../auth/auth.guard.js';
import { CurrentUser } from '../../auth/current-user.decorator.js';
import { Roles } from '../../auth/roles.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { BookingsService } from './bookings.service.js';
import { CancellationsService } from './cancellations.service.js';
import {
  RefundNothingLeftError,
  RefundOverTotalError,
  RefundZeroOrNegativeError,
} from './refund-math.js';
import {
  BookingNotFoundError,
  BookingNotRefundableError,
  ProviderRefundFailedError,
  RefundsService,
} from './refunds.service.js';

/**
 * Admin booking surface (spec P2 W3). Same @Implement composition as
 * BookingsController; the class-level `@Roles(ADMIN)` is read by AuthGuard
 * (getAllAndOverride handler→class), so anonymous → 401, non-admin → 403 —
 * both before oRPC parses any input.
 */
@Controller()
@UseGuards(AuthGuard)
@Roles(UserRole.ADMIN)
export class AdminBookingsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly refunds: RefundsService,
    private readonly cancellations: CancellationsService,
  ) {}

  @Implement(contract.admin.bookings.list)
  list() {
    return implement(contract.admin.bookings.list).handler(({ input }) =>
      this.bookings.adminList(input),
    );
  }

  @Implement(contract.admin.bookings.byCode)
  byCode() {
    return implement(contract.admin.bookings.byCode).handler(async ({ input, errors }) => {
      const booking = await this.bookings.adminByCode(input.code);
      if (!booking) throw errors.NOT_FOUND();
      // W4: the admin detail carries the full D1-B cancellation trail (DENIED
      // history rows survive re-requests), oldest first.
      return {
        ...booking,
        cancellationRequests: await this.cancellations.historyForBooking(booking.id, booking.code),
      };
    });
  }

  @Implement(contract.admin.bookings.refund)
  refund(@CurrentUser() user: SessionUser) {
    return implement(contract.admin.bookings.refund).handler(async ({ input, errors }) => {
      try {
        return await this.refunds.refundByAdmin(user.id, input.code, {
          ...(input.amount !== undefined ? { amount: input.amount } : {}),
          ...(input.reason !== undefined ? { reason: input.reason } : {}),
        });
      } catch (error) {
        if (error instanceof BookingNotFoundError) throw errors.NOT_FOUND();
        if (error instanceof BookingNotRefundableError) {
          throw errors.NOT_REFUNDABLE({ message: error.message });
        }
        if (error instanceof RefundOverTotalError) {
          throw errors.OVER_TOTAL({ message: error.message });
        }
        if (error instanceof RefundZeroOrNegativeError) {
          throw errors.ZERO_OR_NEGATIVE({ message: error.message });
        }
        if (error instanceof RefundNothingLeftError) {
          throw errors.NOTHING_LEFT({ message: error.message });
        }
        if (error instanceof ProviderRefundFailedError) {
          throw errors.REFUND_FAILED({ message: error.message });
        }
        throw error;
      }
    });
  }
}
