import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { SiteMediaController } from './site-media.controller.js';
import { SiteMediaService } from './site-media.service.js';

@Module({
  imports: [MediaModule],
  controllers: [SiteMediaController],
  providers: [SiteMediaService],
})
export class SiteMediaModule {}
