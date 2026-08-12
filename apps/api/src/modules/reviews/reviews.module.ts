import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { WebRevalidationModule } from '../web-revalidation/web-revalidation.module.js';
import { AdminReviewsController } from './admin-reviews.controller.js';
import { ReviewsController } from './reviews.controller.js';
import { ReviewsService } from './reviews.service.js';

@Module({
  // Task 3 (ADR-0016 §3): moderate() bust cache web sau commit qua
  // WebRevalidationService — cần import module để inject vào ReviewsService.
  // Task 6 (ADR-0021 §4): reviews.create nhận photos + chiều đọc trả media —
  // cần MediaModule để inject MediaService.
  imports: [WebRevalidationModule, MediaModule],
  controllers: [ReviewsController, AdminReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
