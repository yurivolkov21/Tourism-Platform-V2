import { Module } from '@nestjs/common';
import { WebRevalidationModule } from '../web-revalidation/web-revalidation.module.js';
import { AdminMediaController } from './admin-media.controller.js';
import { AdminMediaService } from './admin-media.service.js';
import { MediaController } from './media.controller.js';
import { MediaService } from './media.service.js';
import { MediaGarbageModule } from './media-garbage.module.js';
import { UploadSigningService } from './upload-signing.service.js';

@Module({
  controllers: [MediaController, AdminMediaController],
  // `MediaGarbageModule` không có controller nên worker import được nó mà
  // không kéo theo ThrottlerGuard — xem JSDoc ở đó. Media library (ADR-0060)
  // bust cache web sau khi sửa ghi công nên cần WebRevalidationModule.
  imports: [MediaGarbageModule, WebRevalidationModule],
  providers: [MediaService, UploadSigningService, AdminMediaService],
  exports: [MediaGarbageModule, MediaService],
})
export class MediaModule {}
