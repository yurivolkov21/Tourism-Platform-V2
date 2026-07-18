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

/**
 * Authed booking procedures (spec P2 W1), same @Implement pattern as catalog.
 *
 * Guard composition (verified against @orpc/nest 1.14.8 source): on a single
 * procedure, `@Implement` is just `applyDecorators(Post/Get(path), HttpCode,
 * UseInterceptors(ImplementInterceptor))` — the method stays an ordinary Nest
 * route handler, so `@UseGuards` composes at class OR method level, and Nest's
 * lifecycle (guards BEFORE interceptors) means AuthGuard rejects anonymous
 * calls with 401 before oRPC ever parses input. Param decorators also resolve
 * normally — `@CurrentUser()` is bound per-request and captured by the
 * returned handler closure.
 */
@Controller()
@UseGuards(AuthGuard)
export class BookingsController {
  constructor(private readonly bookings: BookingsService) {}

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
}
