import { Controller, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import type { SessionUser } from '../../auth/auth.config.js';
import { AuthGuard } from '../../auth/auth.guard.js';
import { AuthedWriteThrottlerGuard } from '../../auth/authed-write-throttler.guard.js';
import { CurrentUser } from '../../auth/current-user.decorator.js';
import { Roles } from '../../auth/roles.decorator.js';
import { AUTHED_WRITE_THROTTLE } from '../../config/throttle.js';
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
  CancellationOpenError,
  ProviderRefundFailedError,
  RefundsService,
} from './refunds.service.js';

/**
 * Bề mặt booking cho admin (spec P2 W3). Cùng cách ghép @Implement như
 * BookingsController; `@Roles(ADMIN)` ở cấp class được AuthGuard đọc
 * (getAllAndOverride handler→class), nên ẩn danh → 401, không phải admin → 403 —
 * cả hai đều trước khi oRPC parse bất kỳ input nào.
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
      // W4: admin detail mang theo toàn bộ trail cancellation D1-B (các history
      // row DENIED sống sót qua các lần request lại), cũ nhất trước. Từ review
      // F2 31/08 mang thêm sổ cái refund — trang chi tiết in số THẬT ngay khi
      // mở, không phải chờ chính nó phát một refund.
      const [cancellationRequests, refunds] = await Promise.all([
        this.cancellations.historyForBooking(booking.id, booking.code),
        this.refunds.historyForBooking(booking.code),
      ]);
      return { ...booking, cancellationRequests, refunds };
    });
  }

  // Đường ghi TIỀN của admin cũng có trần (vòng vá review 06/09) — xem
  // AUTHED_WRITE_THROTTLE.
  @UseGuards(AuthedWriteThrottlerGuard)
  @Throttle({ default: AUTHED_WRITE_THROTTLE })
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
        if (error instanceof CancellationOpenError) {
          throw errors.CANCELLATION_OPEN({ message: error.message });
        }
        if (error instanceof ProviderRefundFailedError) {
          throw errors.REFUND_FAILED({ message: error.message });
        }
        throw error;
      }
    });
  }
}
