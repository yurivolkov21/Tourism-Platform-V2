import { Injectable } from '@nestjs/common';
import type { Paged, PostCard, PostsListQuery } from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { MediaOwnerType } from '../../generated/prisma/enums.js';
import { MediaService } from '../media/media.service.js';
import { publishedPostWhere } from './published-post.where.js';

const SORT_COLUMN = {
  publishedAt: 'publishedAt',
  createdAt: 'createdAt',
  updatedAt: 'updatedAt',
  title: 'title',
} as const satisfies Record<PostsListQuery['sort'], keyof Prisma.PostOrderByWithRelationInput>;

const postCardInclude = {
  tags: { select: { tag: { select: { slug: true, name: true } } } },
  author: { select: { name: true, image: true } },
} satisfies Prisma.PostInclude;

/**
 * Đọc blog public (spec §4.6, P3a-C) — chỉ bài published-quá-khứ (spread
 * `publishedPostWhere()`, ADR-0004), card gọn (KHÔNG content). Task 5/6 sẽ mở
 * rộng cùng service này (bySlug, tags).
 */
@Injectable()
export class PostsService {
  constructor(private readonly media: MediaService) {}

  async listPosts(query: PostsListQuery): Promise<Paged<PostCard>> {
    const { page, pageSize, sort, order, tag, search } = query;
    const where: Prisma.PostWhereInput = {
      ...publishedPostWhere(),
      ...(tag ? { tags: { some: { tag: { slug: tag } } } } : {}),
      ...(search ? { title: { contains: search, mode: 'insensitive' } } : {}),
    };

    const [total, posts] = await Promise.all([
      prisma.post.count({ where }),
      prisma.post.findMany({
        where,
        include: postCardInclude,
        // Tie-breaker id desc → pagination ổn định khi trùng sort key.
        orderBy: [{ [SORT_COLUMN[sort]]: order }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    // Cover: một query media cho cả trang (chống N+1), pick role hero.
    const coverMap = await this.media.resolveForOwners(
      MediaOwnerType.POST,
      posts.map((p) => p.id),
    );

    const items = posts.map((p): PostCard => {
      const media = coverMap.get(p.id) ?? [];
      const cover = media.find((m) => m.role === 'hero') ?? null;
      // `where` đã spread publishedPostWhere() (publishedAt: { lte: now }) nên
      // publishedAt không thể null ở đây — Prisma vẫn khai kiểu Date | null vì
      // không biết điều kiện WHERE lúc build type, nên thu hẹp bằng runtime
      // check (KHÔNG type cast) để giữ đúng luật "không lách kiểu" của repo.
      if (!p.publishedAt) {
        throw new Error(`invariant violated: published post ${p.id} has null publishedAt`);
      }
      return {
        id: p.id,
        slug: p.slug,
        title: p.title,
        excerpt: p.excerpt,
        publishedAt: p.publishedAt.toISOString(),
        cover,
        tags: p.tags.map((t) => t.tag),
        author: { name: p.author.name, avatarUrl: p.author.image ?? null },
      };
    });

    // Input `pageSize` → output field tên `limit` (convention Paged).
    return { items, page, limit: pageSize, total, totalPages: Math.ceil(total / pageSize) };
  }
}
