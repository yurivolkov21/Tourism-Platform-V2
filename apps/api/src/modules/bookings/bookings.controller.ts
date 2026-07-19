import { Controller, UseGuards } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import type { SessionUser } from '../../auth/auth.config.js';
import { AuthGuard } from '../../auth/auth.guard.js';
import { CurrentUser } from '../../auth/current-user.decorator.js';
import {
  BookingsService,
  DepartureNotAvailableError,
  SeatsUnavailableError,
} from './bookings.service.js';
import {
  BookingNotCancellableError,
  CancellationAlreadyRequestedError,
  CancellationsService,
} from './cancellations.service.js';
import { BookingNotFoundError } from './refunds.service.js';

/**
 * Booking procedures cần auth (spec P2 W1), cùng pattern @Implement như catalog.
 *
 * Cách ghép guard (đã đối chiếu source @orpc/nest 1.14.8): trên một procedure
 * đơn lẻ, `@Implement` chỉ là `applyDecorators(Post/Get(path), HttpCode,
 * UseInterceptors(ImplementInterceptor))` — method vẫn là route handler Nest
 * bình thường, nên `@UseGuards` ghép được ở cấp class HOẶC method, và vòng đời
 * Nest (guard TRƯỚC interceptor) khiến AuthGuard từ chối call ẩn danh bằng 401
 * trước khi oRPC parse input. Param decorator cũng resolve bình thường —
 * `@CurrentUser()` bind theo từng request và được capture bởi closure của
 * handler trả về.
 */
@Controller()
@UseGuards(AuthGuard)
export class BookingsController {
  constructor(
    private readonly bookings: BookingsService,
    private readonly cancellations: CancellationsService,
  ) {}

  @Implement(contract.bookings.create)
  create(@CurrentUser() user: SessionUser) {
    return implement(contract.bookings.create).handler(async ({ input, errors }) => {
      try {
        return await this.bookings.create(user.id, input);
      } catch (error) {
        if (error instanceof DepartureNotAvailableError) {
          throw errors.DEPARTURE_NOT_AVAILABLE({ message: error.message });
        }
        if (error instanceof SeatsUnavailableError) {
          throw errors.SEATS_UNAVAILABLE({ message: error.message });
        }
        throw error;
      }
    });
  }

  @Implement(contract.bookings.mine)
  mine(@CurrentUser() user: SessionUser) {
    return implement(contract.bookings.mine).handler(({ input }) =>
      this.bookings.mine(user.id, input),
    );
  }

  @Implement(contract.bookings.byCode)
  byCode(@CurrentUser() user: SessionUser) {
    return implement(contract.bookings.byCode).handler(async ({ input, errors }) => {
      const booking = await this.bookings.byCode(user.id, input.code);
      if (!booking) throw errors.NOT_FOUND();
      return booking;
    });
  }

  @Implement(contract.bookings.cancel)
  cancel(@CurrentUser() user: SessionUser) {
    return implement(contract.bookings.cancel).handler(async ({ input, errors }) => {
      try {
        return await this.cancellations.request(user.id, input.code, input.reason);
      } catch (error) {
        // Owner-or-404, cùng chính sách với byCode (không lộ sự tồn tại).
        if (error instanceof BookingNotFoundError) throw errors.NOT_FOUND();
        if (error instanceof BookingNotCancellableError) {
          throw errors.NOT_CANCELLABLE({ message: error.message });
        }
        if (error instanceof CancellationAlreadyRequestedError) {
          throw errors.ALREADY_REQUESTED({ message: error.message });
        }
        throw error;
      }
    });
  }
}
