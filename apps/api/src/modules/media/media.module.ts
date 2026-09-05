import { Module } from '@nestjs/common';
import { MediaController } from './media.controller.js';
import { MediaService } from './media.service.js';
import { MediaGarbageModule } from './media-garbage.module.js';
import { UploadSigningService } from './upload-signing.service.js';

@Module({
  controllers: [MediaController],
  // `MediaGarbageModule` không có controller nên worker import được nó mà
  // không kéo theo ThrottlerGuard — xem JSDoc ở đó.
  imports: [MediaGarbageModule],
  providers: [MediaService, UploadSigningService],
  exports: [MediaGarbageModule, MediaService],
})
export class MediaModule {}
