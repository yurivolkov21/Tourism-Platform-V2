import { Controller } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import { Public } from '../../auth/public.decorator.js';
import { PostsService } from './posts.service.js';

// Blog công khai (spec §4.6): khách chưa đăng nhập đọc được. AuthGuard toàn
// cục nên thiếu @Public() là 401 chết cả blog (ADR-0003).
@Public()
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
}
