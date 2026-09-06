import { Controller, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import type { SessionUser } from '../../auth/auth.config.js';
import { AuthedWriteThrottlerGuard } from '../../auth/authed-write-throttler.guard.js';
import { CurrentUser } from '../../auth/current-user.decorator.js';
import { AUTHED_WRITE_THROTTLE } from '../../config/throttle.js';
import { TourNotFoundError, WishlistService } from './wishlist.service.js';

// KHÔNG có @Public(): AuthGuard toàn cục (ADR-0003) sẽ chặn khách ẩn danh.
// Wishlist là dữ liệu cá nhân, mặc định fail-closed đúng là thứ ta muốn.
@Controller()
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  // Đường GHI (W1): trần theo user (AuthGuard toàn cục đã gắn sessionUser
  // trước khi guard method chạy) — xem AUTHED_WRITE_THROTTLE.
  @UseGuards(AuthedWriteThrottlerGuard)
  @Throttle({ default: AUTHED_WRITE_THROTTLE })
  @Implement(contract.wishlist.set)
  set(@CurrentUser() user: SessionUser) {
    return implement(contract.wishlist.set).handler(async ({ input, errors }) => {
      try {
        return await this.wishlist.set(user.id, input.tourId, input.wished);
      } catch (err) {
        if (err instanceof TourNotFoundError) throw errors.TOUR_NOT_FOUND();
        throw err;
      }
    });
  }

  @Implement(contract.wishlist.list)
  list(@CurrentUser() user: SessionUser) {
    return implement(contract.wishlist.list).handler(({ input }) =>
      this.wishlist.list(user.id, input.page, input.pageSize),
    );
  }

  @Implement(contract.wishlist.check)
  check(@CurrentUser() user: SessionUser) {
    return implement(contract.wishlist.check).handler(({ input }) =>
      this.wishlist.check(user.id, input.tourIds),
    );
  }
}
