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
import {
  RefundNothingLeftError,
  RefundOverTotalError,
  RefundZeroOrNegativeError,
} from './refund-math.js';
import { BookingNotRefundableError, ProviderRefundFailedError } from './refunds.service.js';

/**
 * Queue cancellation cho admin (spec P2 W4). Cùng cách ghép guard như
 * AdminBookingsController: `@Roles(ADMIN)` ở cấp class được AuthGuard đọc —
 * ẩn danh → 401, không phải admin → 403, cả hai đều trước khi oRPC parse input.
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
          // ADR-0029 §1 — vắng thì service hoàn TRỌN phần dư như trước.
          ...(input.refundAmount !== undefined ? { refundAmount: input.refundAmount } : {}),
        });
      } catch (error) {
        if (error instanceof CancellationRequestNotFoundError) throw errors.NOT_FOUND();
        if (error instanceof CancellationAlreadyDecidedError) {
          throw errors.ALREADY_DECIDED({ message: error.message });
        }
        // Các gate chỉ áp khi approve và CHỈ khi còn tiền phải chuyển: payment
        // chưa capture, hoặc số tiền gửi lên vượt phần dư. Booking đã settle
        // qua W3 trong lúc request còn treo thì KHÔNG còn rơi vào đây nữa —
        // approve chịu được phần dư 0 (ADR-0029 §2) và vẫn đóng request, huỷ
        // booking, nhả ghế.
        if (error instanceof BookingNotRefundableError || error instanceof RefundNothingLeftError) {
          throw errors.NOT_REFUNDABLE({ message: error.message });
        }
        // Hai lỗi tiền chỉ với tới được từ ADR-0029 §1 (decide nhận số tiền).
        if (error instanceof RefundOverTotalError) {
          throw errors.OVER_TOTAL({ message: error.message });
        }
        if (error instanceof RefundZeroOrNegativeError) {
          throw errors.ZERO_OR_NEGATIVE({ message: error.message });
        }
        if (error instanceof ProviderRefundFailedError) {
          throw errors.REFUND_FAILED({ message: error.message });
        }
        throw error;
      }
    });
  }
}
