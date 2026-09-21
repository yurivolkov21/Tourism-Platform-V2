import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { WebRevalidationModule } from '../web-revalidation/web-revalidation.module.js';
import { AdminCatalogService } from './admin-catalog.service.js';
import { AdminToursController } from './admin-tours.controller.js';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';

@Module({
  // F11 (spec P4e-1): `admin.tours.setPublished` bust cache web sau commit —
  // cần WebRevalidationModule để inject vào AdminCatalogService, cùng nếp
  // ReviewsModule đã làm từ Task 3 của ADR-0016.
  imports: [MediaModule, WebRevalidationModule],
  controllers: [CatalogController, AdminToursController],
  providers: [CatalogService, AdminCatalogService],
})
export class CatalogModule {}
