import { Controller, UseGuards } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import type { SessionUser } from '../../auth/auth.config.js';
import { AuthGuard } from '../../auth/auth.guard.js';
import { CurrentUser } from '../../auth/current-user.decorator.js';
import {
  BookingForbiddenError,
  BookingNotFoundError,
  ReviewAlreadyExistsError,
  ReviewNotEligibleError,
  ReviewsService,
  ReviewTripNotCompletedError,
} from './reviews.service.js';

@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @UseGuards(AuthGuard)
  @Implement(contract.reviews.create)
  create(@CurrentUser() user: SessionUser) {
    return implement(contract.reviews.create).handler(async ({ input, errors }) => {
      try {
        return await this.reviews.create(user.id, input);
      } catch (err) {
        // Map lỗi domain → error code của contract (pattern giống
        // admin-bookings.controller.ts đã có).
        if (err instanceof BookingNotFoundError) throw errors.BOOKING_NOT_FOUND();
        if (err instanceof BookingForbiddenError) throw errors.BOOKING_FORBIDDEN();
        if (err instanceof ReviewTripNotCompletedError) throw errors.REVIEW_TRIP_NOT_COMPLETED();
        if (err instanceof ReviewNotEligibleError) throw errors.REVIEW_NOT_ELIGIBLE();
        if (err instanceof ReviewAlreadyExistsError) throw errors.REVIEW_ALREADY_EXISTS();
        throw err;
      }
    });
  }
}
