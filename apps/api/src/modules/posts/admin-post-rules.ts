import {
  type AdminPostCoverInput,
  type AdminPostDetail,
  type AdminPostRow,
  type AdminPostStatusFilter,
  type MediaItem,
  type PostCoverSource,
  postDisplayStatus,
  postReadiness,
} from '@tourism/contract';
import type { Prisma } from '../../generated/prisma/client.js';
import { PostStatus } from '../../generated/prisma/enums.js';
import { isPostUploadPublicId } from '../../lib/upload-signing.js';
import type { StoredPhoto } from '../catalog/tour-photos.js';
import { POST_TAG_ORDER } from './post-tag-order.js';
import { publishedPostWhere } from './published-post.where.js';

/**
 * Logic THUẦN của quản trị bài viết (spec P4e-4) — bộ lọc trạng thái, hình dạng admin,
 * nguồn ảnh bìa, kế hoạch thay ảnh bìa. Ngoài DB nên test được từng nhánh; service chỉ
 * còn orchestration.
 */

/**
 * Điều kiện của tab lọc — CÙNG luật với `postDisplayStatus` của contract: bài PUBLISHED
 * thiếu ngày đăng là nháp (web không hiện nó). `published` chính là `publishedPostWhere`,
 * nên tab ấy liệt kê đúng những bài web đang hiện.
 */
export function postStatusWhere(filter: AdminPostStatusFilter, now: Date): Prisma.PostWhereInput {
  switch (filter) {
    case 'published':
      return publishedPostWhere(now);
    case 'scheduled':
      return { status: PostStatus.PUBLISHED, publishedAt: { gt: now } };
    case 'draft':
      return { OR: [{ status: PostStatus.DRAFT }, { publishedAt: null }] };
    case 'all':
      return {};
  }
}

export const ADMIN_POST_ROW_SELECT = {
  id: true,
  slug: true,
  title: true,
  status: true,
  publishedAt: true,
  updatedAt: true,
  tags: {
    select: { tag: { select: { slug: true, name: true } } },
    orderBy: POST_TAG_ORDER,
  },
} satisfies Prisma.PostSelect;

export type AdminPostRowRecord = Prisma.PostGetPayload<{ select: typeof ADMIN_POST_ROW_SELECT }>;

export const ADMIN_POST_SELECT = {
  ...ADMIN_POST_ROW_SELECT,
  excerpt: true,
  content: true,
  createdAt: true,
  author: { select: { name: true } },
  relatedTours: {
    orderBy: { order: 'asc' },
    select: { tour: { select: { id: true, slug: true, title: true, isPublished: true } } },
  },
} satisfies Prisma.PostSelect;

export type AdminPostRecord = Prisma.PostGetPayload<{ select: typeof ADMIN_POST_SELECT }>;

/** Một hàng của bảng `/posts`. `coverUrl` do service dựng từ dòng `hero` (một câu cho cả trang). */
export function toAdminPostRow(
  row: AdminPostRowRecord,
  coverUrl: string | null,
  now: Date,
): AdminPostRow {
  const publishedAt = row.publishedAt?.toISOString() ?? null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: row.status,
    publishedAt,
    displayStatus: postDisplayStatus(row.status, publishedAt, now),
    coverUrl,
    tags: row.tags.map((link) => link.tag),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Ảnh bìa đã dựng URL, kèm nguồn — `null` khi bài chưa có dòng `hero`. */
export interface ResolvedCover {
  item: MediaItem;
  source: PostCoverSource;
}

/** Chi tiết cho trang sửa. Phiên bản là `updatedAt` (ADR-0051 §2). */
export function toAdminPostDetail(
  row: AdminPostRecord,
  cover: ResolvedCover | null,
  now: Date,
): AdminPostDetail {
  const base = toAdminPostRow(row, null, now);
  return {
    id: base.id,
    slug: base.slug,
    title: base.title,
    excerpt: row.excerpt,
    content: row.content,
    status: base.status,
    publishedAt: base.publishedAt,
    displayStatus: base.displayStatus,
    readiness: postReadiness({
      content: row.content,
      excerpt: row.excerpt,
      hasCover: cover !== null,
    }),
    tags: base.tags,
    relatedTours: row.relatedTours.map((link) => link.tour),
    cover:
      cover === null
        ? null
        : {
            publicId: cover.item.publicId,
            url: cover.item.url,
            alt: cover.item.alt,
            source: cover.source,
          },
    author: { name: row.author.name },
    version: base.updatedAt,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Nguồn của ảnh bìa (ADR-0048 AMEND 1 áp cho bài viết): thư mục tải lên của chính bài là
 * `UPLOAD`; có dòng thư viện địa danh là `LIBRARY`; còn lại — ảnh catalog của bài seed —
 * là `CATALOG`, gỡ ra thì không chọn lại được.
 */
export function coverSource(
  publicId: string,
  args: { rootFolder: string; postId: string; inLibrary: boolean },
): PostCoverSource {
  if (isPostUploadPublicId(args.rootFolder, args.postId, publicId)) return 'UPLOAD';
  return args.inLibrary ? 'LIBRARY' : 'CATALOG';
}

/** Một dòng ảnh bìa sẽ ghi — cột chép từ nguồn, `alt` theo form (trống là `null`). */
export interface PlannedCoverRow extends StoredPhoto {
  alt: string | null;
}

export type PostCoverPlan =
  | { ok: true; row: PlannedCoverRow | null; requeue: string[] }
  | { ok: false; rejected: string };

/**
 * Ảnh bìa gửi lên → dòng sẽ ghi và ảnh phải vào lại hàng dọn (spec §3.2, ADR-0051 §7).
 *
 * Ảnh bìa thuộc đúng MỘT nguồn, xét theo thứ tự: ảnh bìa HIỆN CÓ (giữ, chỉ đổi alt) →
 * ảnh TẢI LÊN trong thư mục của bài, có metadata (mới) → dòng THƯ VIỆN (mượn, chép ghi
 * công). Không thuộc nguồn nào là từ chối cả lệnh.
 *
 * Ảnh bìa cũ bị thay hay bị gỡ chỉ vào lại hàng dọn khi nó nằm trong thư mục tải lên của
 * chính bài — ảnh thư viện đã kiểm giấy phép, ảnh catalog thì không chọn lại được.
 */
export function planPostCover(args: {
  postId: string;
  rootFolder: string;
  cover: AdminPostCoverInput | null;
  /** Dòng `hero` hiện có của bài. */
  current: StoredPhoto | null;
  /** Dòng `DESTINATION` của publicId gửi lên, nếu có. */
  library: StoredPhoto | null;
}): PostCoverPlan {
  const kept = args.cover?.publicId ?? null;
  const requeue =
    args.current !== null &&
    args.current.publicId !== kept &&
    isPostUploadPublicId(args.rootFolder, args.postId, args.current.publicId)
      ? [args.current.publicId]
      : [];
  if (args.cover === null) return { ok: true, row: null, requeue };

  const source =
    (args.current?.publicId === args.cover.publicId ? args.current : null) ??
    uploadedCover(args.rootFolder, args.postId, args.cover) ??
    (args.library?.publicId === args.cover.publicId ? args.library : null);
  if (source === null) return { ok: false, rejected: args.cover.publicId };
  return { ok: true, row: { ...source, alt: args.cover.alt }, requeue };
}

/** Ảnh tải lên MỚI: đúng thư mục của bài VÀ có metadata Cloudinary — thiếu một là không nhận. */
function uploadedCover(
  rootFolder: string,
  postId: string,
  cover: AdminPostCoverInput,
): StoredPhoto | null {
  if (cover.upload === undefined) return null;
  if (!isPostUploadPublicId(rootFolder, postId, cover.publicId)) return null;
  return {
    publicId: cover.publicId,
    type: 'IMAGE',
    posterId: null,
    format: cover.upload.format,
    width: cover.upload.width,
    height: cover.upload.height,
    durationSec: null,
    bytes: cover.upload.bytes,
    version: cover.upload.version,
    author: null,
    license: null,
    licenseUrl: null,
    sourceUrl: null,
  };
}
