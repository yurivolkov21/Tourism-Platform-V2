import { Controller, UseInterceptors } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import { Public } from '../../auth/public.decorator.js';
import { PublicCacheInterceptor } from '../../lib/public-cache.interceptor.js';
import { PostsService } from './posts.service.js';

// Blog công khai (spec §4.6): khách chưa đăng nhập đọc được. AuthGuard toàn
// cục nên thiếu @Public() là 401 chết cả blog (ADR-0003).
@Public()
// W4 R2 (ADR-0037 AMEND 2): đọc công khai thuần — cache được ở browser/proxy.
@UseInterceptors(PublicCacheInterceptor)
@Controller()
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Implement(contract.posts.list)
  list() {
    return implement(contract.posts.list).handler(({ input }) => this.posts.listPosts(input));
  }

  @Implement(contract.posts.bySlug)
  bySlug() {
    return implement(contract.posts.bySlug).handler(async ({ input, errors }) => {
      const post = await this.posts.getPostBySlug(input.slug);
      if (!post) throw errors.POST_NOT_FOUND();
      return post;
    });
  }

  @Implement(contract.posts.tags)
  tags() {
    return implement(contract.posts.tags).handler(() => this.posts.listTags());
  }
}
