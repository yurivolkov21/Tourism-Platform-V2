import { Injectable } from '@nestjs/common';
import type { Paged, PostCard, PostDetail, PostsListQuery, PostTag } from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { MediaOwnerType } from '../../generated/prisma/enums.js';
import { toTourCard, cardInclude as tourCardInclude } from '../catalog/catalog.service.js';
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
 * `publishedPostWhere()`, ADR-0004), card gọn (KHÔNG content). Task 6 sẽ mở
 * rộng thêm (tags).
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

  /**
   * Detail đầy đủ của MỘT bài đã công bố (spread `publishedPostWhere()`,
   * ADR-0004): content, SEO meta thô, FULL media (mọi role, đã sort
   * hero-đầu — Task 2), và related tours dạng TourCard (KHÔNG media,
   * ADR-0005). Trả null khi không tìm thấy HOẶC bài đang DRAFT/hẹn-giờ-
   * tương-lai — controller dịch cả hai thành CÙNG MỘT POST_NOT_FOUND để
   * không lộ sự tồn tại của bài chưa công bố (ADR-0004).
   */
  async getPostBySlug(slug: string): Promise<PostDetail | null> {
    const post = await prisma.post.findFirst({
      where: { slug, ...publishedPostWhere() },
      include: {
        tags: { select: { tag: { select: { slug: true, name: true } } } },
        author: { select: { name: true, image: true } },
        // Related tours: chỉ tour đã published (unpublish → rớt âm thầm),
        // giữ đúng thứ tự pick. tourCardInclude (import từ catalog) đủ field
        // cho TourCard.
        relatedTours: {
          orderBy: { order: 'asc' },
          where: { tour: { isPublished: true } },
          include: { tour: { include: tourCardInclude } },
        },
      },
    });
    if (!post) return null;

    // Full media (mọi role) cho MỘT bài — không phải batch cover như listPosts.
    const media =
      (await this.media.resolveForOwners(MediaOwnerType.POST, [post.id])).get(post.id) ?? [];
    const cover = media.find((m) => m.role === 'hero') ?? null;
    // Map sang TourCard bằng mapper dùng chung (KHÔNG media — ADR-0005).
    const relatedTours = post.relatedTours.map((rt) => toTourCard(rt.tour));

    // `where` đã spread publishedPostWhere() (publishedAt: { lte: now }) nên
    // publishedAt không thể null ở đây — cùng lý do/kỹ thuật thu hẹp kiểu
    // (runtime check, KHÔNG type cast) như `listPosts` ở trên.
    if (!post.publishedAt) {
      throw new Error(`invariant violated: published post ${post.id} has null publishedAt`);
    }

    return {
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      publishedAt: post.publishedAt.toISOString(),
      cover,
      tags: post.tags.map((t) => t.tag),
      author: { name: post.author.name, avatarUrl: post.author.image ?? null },
      content: post.content,
      metaTitle: post.metaTitle,
      metaDescription: post.metaDescription,
      media,
      relatedTours,
    };
  }

  /**
   * Tag toàn cục CÓ ≥1 bài published, kèm `count`, order theo `name` asc
   * (Task 6). Đếm bằng MỘT query `_count` với nested `where` qua RELATION
   * (`posts` là `PostTagLink[]`, lọc theo `post` bên trong link) — chống
   * N+1 (ADR-0004). Tag count 0 (chỉ có draft/future) bị loại ở tầng JS vì
   * Prisma không lọc được "has count > 0" ngay trong `findMany`.
   */
  async listTags(): Promise<PostTag[]> {
    const rows = await prisma.postTag.findMany({
      orderBy: { name: 'asc' },
      select: {
        slug: true,
        name: true,
        _count: { select: { posts: { where: { post: publishedPostWhere() } } } },
      },
    });
    return rows
      .filter((r) => r._count.posts > 0)
      .map((r) => ({ slug: r.slug, name: r.name, count: r._count.posts }));
  }
}
