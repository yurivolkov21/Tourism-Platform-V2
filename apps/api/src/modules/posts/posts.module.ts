import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module.js';
import { WebRevalidationModule } from '../web-revalidation/web-revalidation.module.js';
import { AdminPostsController } from './admin-posts.controller.js';
import { AdminPostsService } from './admin-posts.service.js';
import { PostsController } from './posts.controller.js';
import { PostsService } from './posts.service.js';

@Module({
  // P4e-4: lệnh ghi bài bust cache web sau commit (ADR-0051 §6) nên cần
  // WebRevalidationModule; MediaModule export cả MediaGarbageModule (hàng dọn).
  imports: [MediaModule, WebRevalidationModule],
  controllers: [PostsController, AdminPostsController],
  providers: [PostsService, AdminPostsService],
})
export class PostsModule {}
