import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { WishlistController } from './wishlist.controller.js';
import { WishlistService } from './wishlist.service.js';

@Module({
  // `MediaModule` cho ảnh bìa của item đã lưu — cùng cách `CatalogModule` nạp.
  imports: [MediaModule],
  controllers: [WishlistController],
  providers: [WishlistService],
})
export class WishlistModule {}
