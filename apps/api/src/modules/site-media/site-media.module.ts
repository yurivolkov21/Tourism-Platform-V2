import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { WebRevalidationModule } from '../web-revalidation/web-revalidation.module.js';
import { AdminAppearanceController } from './admin-appearance.controller.js';
import { AppearanceService } from './appearance.service.js';
import { SiteMediaController } from './site-media.controller.js';
import { SiteMediaService } from './site-media.service.js';

@Module({
  // Appearance (ADR-0059): lưu ảnh khe bust cache web sau commit nên cần
  // WebRevalidationModule; MediaModule export cả MediaGarbageModule (hàng dọn).
  imports: [MediaModule, WebRevalidationModule],
  controllers: [SiteMediaController, AdminAppearanceController],
  providers: [SiteMediaService, AppearanceService],
})
export class SiteMediaModule {}
