import { Injectable, Logger } from '@nestjs/common';
import {
  type AdminPostCoverInput,
  type AdminPostCreateInput,
  type AdminPostCreateResult,
  type AdminPostDeleteInput,
  type AdminPostDeleteResult,
  type AdminPostDetail,
  type AdminPostRow,
  type AdminPostSignCoverUploadInput,
  type AdminPostsListQuery,
  type AdminPostTag,
  type AdminPostUpdateInput,
  normalizePostTags,
  type Paged,
  postReadiness,
  type SignedUploadParams,
} from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { env } from '../../config/env.js';
import type { Prisma } from '../../generated/prisma/client.js';
import { MediaOwnerType, MediaRole, PostStatus } from '../../generated/prisma/enums.js';
import { escapeLike } from '../../lib/like.js';
import { toPaged } from '../../lib/paged.js';
import {
  isPostUploadPublicId,
  postCoverFolder,
  resolveUploadConfig,
  signUploads,
} from '../../lib/upload-signing.js';
import { LIBRARY_PHOTO, prismaCode, STORED_PHOTO_SELECT } from '../catalog/admin-tours.service.js';
import { nextTourVersion } from '../catalog/tour-editor-rules.js';
import { MediaService } from '../media/media.service.js';
import { MediaGarbageService } from '../media/media-garbage.service.js';
import { postRevalidationTags } from '../web-revalidation/revalidation-decision.js';
import { WebRevalidationService } from '../web-revalidation/web-revalidation.service.js';
import {
  AdminPostNotFoundError,
  PostCoverUploadsNotConfiguredError,
  PostNotReadyError,
  PostPhotoNotAllowedError,
  PostSlugTakenError,
  RelatedTourNotFoundError,
  StalePostError,
} from './admin-post-errors.js';
import {
  ADMIN_POST_ROW_SELECT,
  ADMIN_POST_SELECT,
  type AdminPostRecord,
  coverSource,
  planPostCover,
  postStatusWhere,
  toAdminPostDetail,
  toAdminPostRow,
} from './admin-post-rules.js';

/**
 * Câu ĐẦU TIÊN của lệnh sửa và lệnh xoá: so phiên bản và giành hàng bài trong MỘT câu
 * `UPDATE … WHERE id = ? AND updated_at = ?` — khuôn `claimTour` (ADR-0047 §3). Hai lệnh
 * cùng phiên bản xếp hàng trên khoá hàng; lệnh đến sau đếm được 0.
 *
 * Đếm 0 thì câu thứ hai chỉ để chọn MÃ: hàng còn là phiên bản cũ, mất là bài không còn.
 * Trả phiên bản mới để câu ghi sau trong transaction đặt đúng giá trị ấy — không truyền
 * thì Prisma tự đặt `now()` và phiên bản trả về lệch thứ vừa so.
 */
async function claimPost(
  tx: Prisma.TransactionClient,
  id: string,
  version: string,
  now: Date,
): Promise<Date> {
  // Cùng luật nhích phiên bản với tour: hai lần lưu trong một mili-giây vẫn ra hai phiên bản.
  const next = nextTourVersion(version, now);
  const { count } = await tx.post.updateMany({
    where: { id, updatedAt: new Date(version) },
    data: { updatedAt: next },
  });
  if (count === 0) {
    const exists = await tx.post.findUnique({ where: { id }, select: { id: true } });
    throw exists ? new StalePostError() : new AdminPostNotFoundError(id);
  }
  return next;
}

/**
 * Thay trọn tag (spec §2.5): tag chưa có thì tạo; có rồi thì giữ tên của người tạo đầu tiên.
 * Thứ tự gửi lên thành `order` của dây — tag đầu làm chip danh mục ở web (vòng review P4e-4).
 */
async function replaceTags(
  tx: Prisma.TransactionClient,
  postId: string,
  names: readonly string[],
): Promise<void> {
  await tx.postTagLink.deleteMany({ where: { postId } });
  const tags = normalizePostTags(names);
  if (tags.length === 0) return;
  // `skipDuplicates` = ON CONFLICT DO NOTHING: tag đã có không bị đổi tên, hai admin cùng
  // tạo một tag cũng không đụng nhau.
  await tx.postTag.createMany({ data: tags, skipDuplicates: true });
  const rows = await tx.postTag.findMany({
    where: { slug: { in: tags.map((tag) => tag.slug) } },
    select: { id: true, slug: true },
  });
  // `findMany` không giữ thứ tự của `in` — ghép lại theo slug rồi đánh số theo input.
  const idBySlug = new Map(rows.map((row) => [row.slug, row.id]));
  await tx.postTagLink.createMany({
    data: tags.flatMap((tag, order) => {
      const tagId = idBySlug.get(tag.slug);
      return tagId === undefined ? [] : [{ postId, tagId, order }];
    }),
  });
}

/** Thay trọn tour liên quan; thứ tự là thứ tự gửi lên (`post_tours.order`). */
async function replaceRelatedTours(
  tx: Prisma.TransactionClient,
  postId: string,
  tourIds: readonly string[],
): Promise<void> {
  await tx.postTour.deleteMany({ where: { postId } });
  if (tourIds.length === 0) return;
  await tx.postTour
    .createMany({ data: tourIds.map((tourId, order) => ({ postId, tourId, order })) })
    .catch((error: unknown) => {
      // Khoá ngoại bắt tại câu ghi (bài học F14) — không SELECT kiểm trước.
      if (prismaCode(error) === 'P2003') throw new RelatedTourNotFoundError();
      throw error;
    });
}

/** Thay dòng ảnh bìa (role `hero`); trả các publicId phải vào lại hàng dọn. */
async function replaceCover(
  tx: Prisma.TransactionClient,
  postId: string,
  cover: AdminPostCoverInput | null,
): Promise<string[]> {
  const heroOf = { ownerType: MediaOwnerType.POST, ownerId: postId, role: MediaRole.hero };
  // MỌI dòng hero, cùng thứ tự với đường đọc (`resolveForOwners`). Thường chỉ có một; dữ
  // liệu script có thể để lại hai — khi ấy ảnh admin đang giữ là dòng nào cũng nhận ra,
  // thay vì so với dòng cũ nhất rồi từ chối nhầm (vòng review P4e-4).
  const heroes = await tx.mediaAsset.findMany({
    where: heroOf,
    select: STORED_PHOTO_SELECT,
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
  });
  const current = heroes.find((hero) => hero.publicId === cover?.publicId) ?? heroes[0] ?? null;
  const library =
    cover === null || cover.publicId === current?.publicId
      ? null
      : await tx.mediaAsset.findFirst({
          where: { ...LIBRARY_PHOTO, publicId: cover.publicId },
          select: STORED_PHOTO_SELECT,
          orderBy: { createdAt: 'asc' },
        });
  const plan = planPostCover({
    postId,
    rootFolder: env.CLOUDINARY_UPLOAD_FOLDER,
    cover,
    current,
    library,
  });
  if (!plan.ok) throw new PostPhotoNotAllowedError(plan.rejected);
  // Dòng hero thừa cũng đi theo deleteMany — ảnh tải lên của chính bài thì vào hàng dọn
  // như ảnh bị thay; ảnh đang giữ thì không.
  const strays = heroes
    .filter((hero) => hero !== current && hero.publicId !== cover?.publicId)
    .map((hero) => hero.publicId)
    .filter((publicId) => isPostUploadPublicId(env.CLOUDINARY_UPLOAD_FOLDER, postId, publicId));
  await tx.mediaAsset.deleteMany({ where: heroOf });
  if (plan.row !== null) {
    await tx.mediaAsset.create({
      data: {
        ...plan.row,
        ownerType: MediaOwnerType.POST,
        ownerId: postId,
        role: MediaRole.hero,
        sortOrder: 0,
      },
    });
  }
  return [...new Set([...plan.requeue, ...strays])];
}

/**
 * Quản trị bài viết (spec P4e-4, ADR-0051) — các thao tác của `admin.posts.*`.
 *
 * Mọi lỗi DB bắt NGAY tại câu ghi, không SELECT kiểm trước (bài học F14): slug trùng →
 * `P2002`, tour liên quan không có → `P2003`. Bust cache web SAU commit, fire-and-forget;
 * lệnh ghi hỏng thì không bust.
 */
@Injectable()
export class AdminPostsService {
  private readonly logger = new Logger(AdminPostsService.name);

  constructor(
    private readonly media: MediaService,
    private readonly garbage: MediaGarbageService,
    private readonly webRevalidation: WebRevalidationService,
  ) {}

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

  /**
   * Lưu cả form (spec §3.2). Thứ tự trong transaction: giành hàng bài → cổng "đủ mới được
   * đăng" (tính từ chính input — mọi thứ nó xét đều do lệnh này thay) → ghi cột → thay
   * tag → thay tour liên quan → thay ảnh bìa → ảnh tải lên bị thay vào lại hàng dọn.
   */
  async update(input: AdminPostUpdateInput): Promise<AdminPostDetail> {
    const now = new Date();
    const slug = await prisma.$transaction(async (tx) => {
      const version = await claimPost(tx, input.id, input.version, now);
      if (input.status === 'PUBLISHED') {
        const missing = postReadiness({
          content: input.content,
          excerpt: input.excerpt,
          hasCover: input.cover !== null,
        });
        if (missing.length > 0) throw new PostNotReadyError(missing);
      }
      const saved = await tx.post.update({
        where: { id: input.id },
        data: {
          title: input.title,
          excerpt: input.excerpt,
          content: input.content,
          status: input.status,
          publishedAt: input.publishedAt === null ? null : new Date(input.publishedAt),
          updatedAt: version,
        },
        select: { slug: true },
      });
      await replaceTags(tx, input.id, input.tags);
      await replaceRelatedTours(tx, input.id, input.relatedTourIds);
      const requeue = await replaceCover(tx, input.id, input.cover);
      // Cùng transaction (ADR-0035 §7): rollback thì hàng dọn không giữ dấu vết nào.
      await this.garbage.requeue(tx, requeue);
      return saved.slug;
    });

    this.logger.log(`[admin] post saved ${JSON.stringify({ id: input.id, status: input.status })}`);
    this.bust(slug);
    return this.get(slug, now);
  }

  /**
   * Xoá bài (spec §2.7). Một transaction: giành hàng bài (phiên bản) → đọc dòng media →
   * xoá bài (Cascade kéo `post_tag_links`, `post_tours`) → xoá dòng media (bảng đa chủ,
   * không khoá ngoại) → ảnh tải lên của chính bài vào lại hàng dọn. Tag ở lại. Bust sau
   * commit.
   */
  async delete(input: AdminPostDeleteInput): Promise<AdminPostDeleteResult> {
    const now = new Date();
    const deleted = await prisma.$transaction(async (tx) => {
      await claimPost(tx, input.id, input.version, now);
      const owned = { ownerType: MediaOwnerType.POST, ownerId: input.id };
      const media = await tx.mediaAsset.findMany({ where: owned, select: { publicId: true } });
      const removed = await tx.post.delete({ where: { id: input.id }, select: { slug: true } });
      await tx.mediaAsset.deleteMany({ where: owned });
      await this.garbage.requeue(
        tx,
        media
          .map((row) => row.publicId)
          .filter((publicId) =>
            isPostUploadPublicId(env.CLOUDINARY_UPLOAD_FOLDER, input.id, publicId),
          ),
      );
      return removed;
    });

    this.logger.log(`[admin] post deleted ${JSON.stringify({ id: input.id, slug: deleted.slug })}`);
    this.bust(deleted.slug);
    return { slug: deleted.slug };
  }

  /**
   * Ký MỘT lượt tải ảnh bìa vào thư mục của bài (ADR-0051 §7). publicId vào hàng dọn NGAY
   * lúc ký (ADR-0035 §3): tải lên rồi không lưu thì bảy ngày sau tự được dọn.
   */
  async signCoverUpload(input: AdminPostSignCoverUploadInput): Promise<SignedUploadParams> {
    const cfg = resolveUploadConfig(env);
    if (!cfg) throw new PostCoverUploadsNotConfiguredError();
    const exists = await prisma.post.findUnique({ where: { id: input.id }, select: { id: true } });
    if (!exists) throw new AdminPostNotFoundError(input.id);

    const { params, publicIds } = signUploads(
      cfg,
      postCoverFolder(cfg.rootFolder, input.id),
      1,
      new Date(),
    );
    await this.garbage.enqueueQuietly(publicIds);
    const [signed] = params;
    if (signed === undefined) throw new Error('signUploads trả rỗng cho một lượt ký');
    this.logger.log(`[admin] post cover upload signed ${JSON.stringify({ id: input.id })}`);
    return signed;
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

  /**
   * Bust cache web SAU khi lệnh ghi đã xong (ADR-0016 §3). `void` có chủ đích — đường này
   * chết thì site chỉ kém tươi, còn lệnh ghi đã ăn rồi.
   */
  private bust(slug: string): void {
    void this.webRevalidation.revalidate(postRevalidationTags(slug));
  }
}
