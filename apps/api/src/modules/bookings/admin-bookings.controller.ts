import { Controller } from '@nestjs/common';
import { implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import { AdminImplement } from '../../auth/admin-implement.decorator.js';
import type { SessionUser } from '../../auth/auth.config.js';
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
 * Bề mặt booking cho admin (spec P2 W3). Cùng cách ghép @Implement như
 * BookingsController; `@Roles(ADMIN)` cấp class là lưới; quyền thật của từng handler do
 * `@AdminImplement` suy từ bảng `ADMIN_ACCESS` (ADR-0052) — ẩn danh → 401, khách → 403,
 * Staff → 403 ở thủ tục chỉ Owner — cả hai đều trước khi oRPC parse bất kỳ
 * input nào.
 */
@Controller()
@Roles(UserRole.ADMIN)
export class AdminBookingsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly refunds: RefundsService,
    private readonly cancellations: CancellationsService,
  ) {}

  @AdminImplement(contract.admin.bookings.list)
  list() {
    return implement(contract.admin.bookings.list).handler(({ input }) =>
      this.bookings.adminList(input),
    );
  }

  @AdminImplement(contract.admin.bookings.byCode)
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

  @AdminImplement(contract.admin.bookings.refund)
  refund(@CurrentUser() user: SessionUser) {
    return implement(contract.admin.bookings.refund).handler(async ({ input, errors }) => {
      try {
        // W2 (ADR-0030 AMEND 1): contract đã ép amount + reason — truyền thẳng.
        return await this.refunds.refundByAdmin(user.id, input.code, {
          amount: input.amount,
          reason: input.reason,
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
