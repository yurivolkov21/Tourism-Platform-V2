import { Module } from '@nestjs/common';
import { MediaController } from './media.controller.js';
import { MediaService } from './media.service.js';
import { UploadSigningService } from './upload-signing.service.js';

@Module({
  controllers: [MediaController],
  providers: [MediaService, UploadSigningService],
  exports: [MediaService],
})
export class MediaModule {}
