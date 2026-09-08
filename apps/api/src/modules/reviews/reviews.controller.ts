import { Controller, UseInterceptors } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import type { SessionUser } from '../../auth/auth.config.js';
import { CurrentUser } from '../../auth/current-user.decorator.js';
import { Public } from '../../auth/public.decorator.js';
import { PublicCacheInterceptor } from '../../lib/public-cache.interceptor.js';
import {
  BookingForbiddenError,
  BookingNotFoundError,
  ReviewAlreadyExistsError,
  ReviewNotEditableError,
  ReviewNotEligibleError,
  ReviewNotFoundError,
  ReviewNotRetractableError,
  ReviewPhotoInvalidError,
  ReviewsService,
  ReviewTripNotCompletedError,
  TourNotFoundError,
} from './reviews.service.js';

@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  /** Public — review đã duyệt của một tour, không cần đăng nhập. */
  // Review đã duyệt hiển thị công khai trên trang tour. `mine`/`create`
  // ngay bên dưới KHÔNG có @Public() nên vẫn cần auth — decorator ở method
  // thắng class, đó là lý do đánh dấu từng method thay vì cả controller.
  @Public()
  // Đọc công khai thuần, gọi từ browser lẫn lúc build — cùng lớp cache với
  // catalog (W4 R2, vòng vá review W4 bổ sung: từng sót).
  @UseInterceptors(PublicCacheInterceptor)
  @Implement(contract.reviews.listByTour)
  listByTour() {
    return implement(contract.reviews.listByTour).handler(async ({ input, errors }) => {
      try {
        return await this.reviews.listByTour(input);
      } catch (err) {
        if (err instanceof TourNotFoundError) throw errors.TOUR_NOT_FOUND();
        throw err;
      }
    });
  }

  /** Authed — review của chính user gọi API, kể cả chưa duyệt. */
  @Implement(contract.reviews.mine)
  mine(@CurrentUser() user: SessionUser) {
    return implement(contract.reviews.mine).handler(({ input }) =>
      this.reviews.mine(user.id, input.page, input.pageSize),
    );
  }

  // Đường GHI: trần mặc định toàn cục lo (ADR-0037 — authed theo user).
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
        if (err instanceof ReviewPhotoInvalidError) throw errors.REVIEW_PHOTO_INVALID();
        throw err;
      }
    });
  }

  /**
   * Sửa review của chính mình (ADR-0032). `REVIEW_NOT_FOUND` phủ cả ca
   * không-phải-của-mình — service gộp hai ca ấy có chủ đích, xem JSDoc ở đó.
   */
  // Đường GHI: trần mặc định toàn cục lo (ADR-0037 — authed theo user).
  @Implement(contract.reviews.update)
  update(@CurrentUser() user: SessionUser) {
    return implement(contract.reviews.update).handler(async ({ input, errors }) => {
      try {
        return await this.reviews.update(user.id, input);
      } catch (err) {
        if (err instanceof ReviewNotFoundError) throw errors.REVIEW_NOT_FOUND();
        if (err instanceof ReviewNotEditableError) throw errors.REVIEW_NOT_EDITABLE();
        if (err instanceof ReviewPhotoInvalidError) throw errors.REVIEW_PHOTO_INVALID();
        throw err;
      }
    });
  }

  /**
   * W4 U2 (ADR-0032 AMEND 1): tác giả rút review đã duyệt — chung cuộc.
   * Cùng luật 404 chống dò với `update`.
   */
  // Đường GHI: trần mặc định toàn cục lo (ADR-0037 — authed theo user).
  @Implement(contract.reviews.retract)
  retract(@CurrentUser() user: SessionUser) {
    return implement(contract.reviews.retract).handler(async ({ input, errors }) => {
      try {
        return await this.reviews.retract(user.id, input);
      } catch (err) {
        if (err instanceof ReviewNotFoundError) throw errors.REVIEW_NOT_FOUND();
        if (err instanceof ReviewNotRetractableError) throw errors.REVIEW_NOT_RETRACTABLE();
        throw err;
      }
    });
  }
}
