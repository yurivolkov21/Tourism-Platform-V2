import { Injectable, Logger } from '@nestjs/common';
import type {
  AdminPostCreateInput,
  AdminPostCreateResult,
  AdminPostDetail,
  AdminPostRow,
  AdminPostsListQuery,
  AdminPostTag,
  Paged,
} from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { env } from '../../config/env.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { MediaOwnerType, MediaRole, PostStatus } from '../../generated/prisma/enums.js';
import { escapeLike } from '../../lib/like.js';
import { toPaged } from '../../lib/paged.js';
import { LIBRARY_PHOTO, prismaCode } from '../catalog/admin-tours.service.js';
import { MediaService } from '../media/media.service.js';
import { AdminPostNotFoundError, PostSlugTakenError } from './admin-post-errors.js';
import {
  ADMIN_POST_ROW_SELECT,
  ADMIN_POST_SELECT,
  type AdminPostRecord,
  coverSource,
  postStatusWhere,
  toAdminPostDetail,
  toAdminPostRow,
} from './admin-post-rules.js';

/**
 * Quản trị bài viết (spec P4e-4, ADR-0051) — các thao tác của `admin.posts.*`.
 *
 * Mọi lỗi DB bắt NGAY tại câu ghi, không SELECT kiểm trước (bài học F14): slug trùng là
 * `P2002`.
 */
@Injectable()
export class AdminPostsService {
  private readonly logger = new Logger(AdminPostsService.name);

  constructor(private readonly media: MediaService) {}

  /** Một trang bài, sửa gần nhất trước. Ảnh bìa nhỏ: MỘT câu media cho cả trang. */
  async list(query: AdminPostsListQuery, now: Date = new Date()): Promise<Paged<AdminPostRow>> {
    const where: Prisma.PostWhereInput = {
      ...postStatusWhere(query.status, now),
      // escapeLike (cùng luật danh sách công khai): `%`/`_` gõ vào ô tìm là chữ, không phải wildcard.
      ...(query.search
        ? { title: { contains: escapeLike(query.search), mode: 'insensitive' } }
        : {}),
    };
    const [total, rows] = await Promise.all([
      prisma.post.count({ where }),
      prisma.post.findMany({
        where,
        select: ADMIN_POST_ROW_SELECT,
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
    ]);
    const covers = await this.media.resolveForOwners(
      MediaOwnerType.POST,
      rows.map((row) => row.id),
      [MediaRole.hero],
    );
    const items = rows.map((row) => toAdminPostRow(row, covers.get(row.id)?.[0]?.url ?? null, now));
    return toPaged(items, { page: query.page, limit: query.limit, total });
  }

  /** Một bài, mọi trạng thái — nháp và bài hẹn giờ chính là bài đang được soạn. */
  async get(slug: string, now: Date = new Date()): Promise<AdminPostDetail> {
    const row = await prisma.post.findUnique({ where: { slug }, select: ADMIN_POST_SELECT });
    if (!row) throw new AdminPostNotFoundError(slug);
    return this.toDetail(row, now);
  }

  /** Bài mới là nháp, thân bài rỗng; tác giả là admin đang tạo. Không bust: web chưa thấy nháp. */
  async create(input: AdminPostCreateInput, authorId: string): Promise<AdminPostCreateResult> {
    const created = await prisma.post
      .create({
        data: {
          slug: input.slug,
          title: input.title,
          content: '',
          status: PostStatus.DRAFT,
          authorId,
        },
        select: { id: true, slug: true },
      })
      .catch((error: unknown) => {
        if (prismaCode(error) === 'P2002') throw new PostSlugTakenError(input.slug);
        throw error;
      });
    this.logger.log(`[admin] post created ${JSON.stringify(created)}`);
    return created;
  }

  /** Mọi tag kèm số bài dùng nó, CẢ nháp — tag không còn bài nào vẫn có mặt với số 0. */
  async tags(): Promise<AdminPostTag[]> {
    const rows = await prisma.postTag.findMany({
      orderBy: { name: 'asc' },
      select: { slug: true, name: true, _count: { select: { posts: true } } },
    });
    return rows.map((row) => ({ slug: row.slug, name: row.name, count: row._count.posts }));
  }

  /** Chi tiết kèm ảnh bìa và nguồn của nó — một câu media, một câu đếm thư viện. */
  private async toDetail(row: AdminPostRecord, now: Date): Promise<AdminPostDetail> {
    const media = await this.media.resolveForOwners(
      MediaOwnerType.POST,
      [row.id],
      [MediaRole.hero],
    );
    const item = media.get(row.id)?.[0] ?? null;
    if (item === null) return toAdminPostDetail(row, null, now);
    const inLibrary =
      (await prisma.mediaAsset.count({ where: { ...LIBRARY_PHOTO, publicId: item.publicId } })) > 0;
    const source = coverSource(item.publicId, {
      rootFolder: env.CLOUDINARY_UPLOAD_FOLDER,
      postId: row.id,
      inLibrary,
    });
    return toAdminPostDetail(row, { item, source }, now);
  }
}
