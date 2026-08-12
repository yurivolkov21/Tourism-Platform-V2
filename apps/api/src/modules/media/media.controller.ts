import { Controller, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import type { SessionUser } from '../../auth/auth.config.js';
import { AuthGuard } from '../../auth/auth.guard.js';
import { CurrentUser } from '../../auth/current-user.decorator.js';
import {
  BookingForbiddenError,
  BookingNotFoundError,
  ReviewNotEligibleError,
  ReviewTripNotCompletedError,
} from '../reviews/reviews.service.js';
import { UploadSigningService, UploadsNotConfiguredError } from './upload-signing.service.js';

/** Adapter mỏng cho media.signUpload — luật thật nằm trong service. */
@Controller()
export class MediaController {
  constructor(private readonly signing: UploadSigningService) {}

  // Endpoint GHI đã-auth ĐẦU TIÊN có throttle riêng (ThrottlerGuard, dùng
  // chung config PUBLIC_WRITE_THROTTLE toàn cục) — chống spam ký upload
  // (mỗi lần ký là một round-trip Cloudinary sẵn sàng nhận file).
  @UseGuards(AuthGuard, ThrottlerGuard)
  @Implement(contract.media.signUpload)
  signUpload(@CurrentUser() user: SessionUser) {
    return implement(contract.media.signUpload).handler(async ({ input, errors }) => {
      try {
        return await this.signing.signUpload(user.id, input);
      } catch (err) {
        if (err instanceof UploadsNotConfiguredError) throw errors.MEDIA_UPLOAD_NOT_CONFIGURED();
        if (err instanceof BookingNotFoundError) throw errors.BOOKING_NOT_FOUND();
        if (err instanceof BookingForbiddenError) throw errors.BOOKING_FORBIDDEN();
        if (err instanceof ReviewTripNotCompletedError) throw errors.REVIEW_TRIP_NOT_COMPLETED();
        if (err instanceof ReviewNotEligibleError) throw errors.REVIEW_NOT_ELIGIBLE();
        throw err;
      }
    });
  }
}
