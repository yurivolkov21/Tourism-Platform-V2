import { Module } from '@nestjs/common';
import { WebRevalidationModule } from '../web-revalidation/web-revalidation.module.js';
import { AdminReviewsController } from './admin-reviews.controller.js';
import { ReviewsController } from './reviews.controller.js';
import { ReviewsService } from './reviews.service.js';

@Module({
  // Task 3 (ADR-0016 §3): moderate() bust cache web sau commit qua
  // WebRevalidationService — cần import module để inject vào ReviewsService.
  imports: [WebRevalidationModule],
  controllers: [ReviewsController, AdminReviewsController],
  providers: [ReviewsService],
  exports: [ReviewsService],
})
export class ReviewsModule {}
