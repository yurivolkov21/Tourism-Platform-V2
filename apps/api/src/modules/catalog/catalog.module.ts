import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { WebRevalidationModule } from '../web-revalidation/web-revalidation.module.js';
import { AdminCatalogService } from './admin-catalog.service.js';
import { AdminDeparturesController } from './admin-departures.controller.js';
import { AdminDeparturesService } from './admin-departures.service.js';
import { AdminToursController } from './admin-tours.controller.js';
import { CatalogController } from './catalog.controller.js';
import { CatalogService } from './catalog.service.js';
import { DepartureCancelService } from './departure-cancel.service.js';

@Module({
  // F11 và F12 (spec P4e-1): `admin.tours.setPublished` và ba lệnh ghi của
  // `admin.departures.*` đều bust cache web SAU commit — cả hai service cần
  // WebRevalidationModule, cùng nếp ReviewsModule đã làm từ Task 3 của ADR-0016.
  imports: [MediaModule, WebRevalidationModule],
  controllers: [CatalogController, AdminToursController, AdminDeparturesController],
  providers: [
    CatalogService,
    AdminCatalogService,
    AdminDeparturesService,
    // F13: huỷ chuyến có hoàn tiền — service riêng vì nó là lệnh ghi duy nhất
    // của vùng catalog tiêu tiền thật.
    DepartureCancelService,
  ],
})
export class CatalogModule {}
