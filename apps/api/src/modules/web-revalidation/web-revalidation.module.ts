import { Module } from '@nestjs/common';
import { WebRevalidationService } from './web-revalidation.service.js';

@Module({
  providers: [WebRevalidationService],
  exports: [WebRevalidationService],
})
export class WebRevalidationModule {}
