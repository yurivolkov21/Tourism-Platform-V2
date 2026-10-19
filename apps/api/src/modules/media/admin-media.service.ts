import { Injectable, Logger } from '@nestjs/common';
import {
  type AdminMediaItem,
  type AdminMediaQueue,
  type AdminMediaUpdateInput,
  type MediaLastSweep,
  type MediaUsageOwner,
  mediaAltRequired,
  SITE_SLOT_KEYS,
  type SiteSlotKey,
} from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { env } from '../../config/env.js';
import { Prisma } from '../../generated/prisma/client.js';
import { MediaOwnerType, MediaType } from '../../generated/prisma/enums.js';
import { nextTourVersion } from '../catalog/tour-editor-rules.js';
import { WebRevalidationService } from '../web-revalidation/web-revalidation.service.js';
import {
  MediaAltRequiredError,
  MediaNotFoundError,
  StaleMediaError,
} from './admin-media-errors.js';
import { MEDIA_GC_QUEUE } from './media-garbage.js';
import {
  groupByPublicId,
  type MediaLibraryRow,
  mediaUpdateTags,
  mediaVersion,
  type OwnerInfo,
  ownerRef,
  ownersInLockOrder,
  rowsToWrite,
  toMediaItem,
} from './media-library-rules.js';
import {
  LOOKUP_ZONES,
  parseSweepOutput,
  parseUploadZone,
  toQueueRow,
} from './media-queue-rules.js';

/** Bốn loại chủ là chỗ dùng (ADR-0060 §1); REVIEW, avatar và video không vào trang này. */
const USAGE_OWNERS = [
  MediaOwnerType.TOUR,
  MediaOwnerType.DESTINATION,
  MediaOwnerType.POST,
  MediaOwnerType.SITE,
] as const satisfies readonly MediaUsageOwner[];

const USAGE_WHERE = {
  type: MediaType.IMAGE,
  ownerType: { in: [...USAGE_OWNERS] },
} satisfies Prisma.MediaAssetWhereInput;

const LIBRARY_ROW_SELECT = {
  id: true,
  publicId: true,
  ownerType: true,
  ownerId: true,
  role: true,
  sortOrder: true,
  alt: true,
  author: true,
  license: true,
  licenseUrl: true,
  sourceUrl: true,
  width: true,
  height: true,
  bytes: true,
  format: true,
  version: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MediaAssetSelect;

type SelectedRow = Prisma.MediaAssetGetPayload<{ select: typeof LIBRARY_ROW_SELECT }>;

const isUsageOwner = (ownerType: MediaOwnerType): ownerType is MediaUsageOwner =>
  (USAGE_OWNERS as readonly MediaOwnerType[]).includes(ownerType);

/** Khép kiểu loại chủ về bốn loại của trang — `USAGE_WHERE` đã lọc, đây chỉ là lưới kiểu. */
function toLibraryRows(rows: readonly SelectedRow[]): MediaLibraryRow[] {
  return rows.flatMap((row) => {
    const { ownerType } = row;
    return isUsageOwner(ownerType) ? [{ ...row, ownerType }] : [];
  });
}

const SLOT_KEYS: ReadonlySet<string> = new Set(SITE_SLOT_KEYS);
const isSlotKey = (key: string): key is SiteSlotKey => SLOT_KEYS.has(key);

/** Một chủ đã khoá `FOR UPDATE`: phiên bản để chạm, slug để bust. */
interface LockedOwner {
  id: string;
  slug: string | null;
  updated_at: Date;
}

/**
 * Khoá hàng chủ của một loại, theo id (ADR-0060 §3 bước 2). `ORDER BY` nằm dưới `FOR UPDATE`
 * nên Postgres khoá đúng theo thứ tự đã sắp. Tên bảng là hằng của code, không phải input.
 */
async function lockOwners(
  tx: Prisma.TransactionClient,
  ownerType: MediaUsageOwner,
  ids: readonly string[],
): Promise<LockedOwner[]> {
  const idList = [...ids];
  switch (ownerType) {
    case 'TOUR':
      return tx.$queryRaw<LockedOwner[]>(Prisma.sql`
        SELECT id, slug, updated_at FROM tours
        WHERE id = ANY(${idList}::uuid[]) ORDER BY id FOR UPDATE`);
    case 'DESTINATION':
      return tx.$queryRaw<LockedOwner[]>(Prisma.sql`
        SELECT id, slug, updated_at FROM destinations
        WHERE id = ANY(${idList}::uuid[]) ORDER BY id FOR UPDATE`);
    case 'POST':
      return tx.$queryRaw<LockedOwner[]>(Prisma.sql`
        SELECT id, slug, updated_at FROM posts
        WHERE id = ANY(${idList}::uuid[]) ORDER BY id FOR UPDATE`);
    case 'SITE':
      return tx.$queryRaw<LockedOwner[]>(Prisma.sql`
        SELECT id, NULL::text AS slug, updated_at FROM site_media_slots
        WHERE id = ANY(${idList}::uuid[]) ORDER BY id FOR UPDATE`);
  }
}

/**
 * Nhích `updatedAt` của một chủ (ADR-0060 §3 bước 5): trình sửa đang mở của chủ ấy nhận lỗi
 * version một lần thay vì âm thầm ghi đè alt vừa sửa. Cùng luật luôn tăng với tour và bài viết.
 */
async function touchOwner(
  tx: Prisma.TransactionClient,
  ownerType: MediaUsageOwner,
  owner: LockedOwner,
  now: Date,
): Promise<void> {
  const data = { updatedAt: nextTourVersion(owner.updated_at.toISOString(), now) };
  switch (ownerType) {
    case 'TOUR':
      await tx.tour.update({ where: { id: owner.id }, data });
      return;
    case 'DESTINATION':
      await tx.destination.update({ where: { id: owner.id }, data });
      return;
    case 'POST':
      await tx.post.update({ where: { id: owner.id }, data });
      return;
    case 'SITE':
      await tx.siteMediaSlot.update({ where: { id: owner.id }, data });
      return;
  }
}

/** Hai mốc giờ của job `media-gc` mới nhất đọc thẳng từ bảng của pg-boss. */
interface SweepJobRow {
  state: MediaLastSweep['state'];
  started_on: Date | null;
  completed_on: Date | null;
  output: unknown;
}

/**
 * Media library (ADR-0060) — các thao tác của `admin.media.*`.
 *
 * Bust cache web SAU commit, fire-and-forget; lệnh ghi hỏng hay không đổi gì thì không bust.
 */
@Injectable()
export class AdminMediaService {
  private readonly logger = new Logger(AdminMediaService.name);

  constructor(private readonly webRevalidation: WebRevalidationService) {}

  /** Mọi ảnh đang dùng, mỗi ảnh một mục (ADR-0060 §2). Hai lượt đọc: dòng ảnh, rồi tên chủ. */
  async list(): Promise<AdminMediaItem[]> {
    const rows = toLibraryRows(
      await prisma.mediaAsset.findMany({ where: USAGE_WHERE, select: LIBRARY_ROW_SELECT }),
    );
    const owners = await this.ownerInfo(rows);
    return groupByPublicId(rows).map((group) => toMediaItem(group, this.itemContext(owners)));
  }

  /**
   * Ghi alt và ghi công vào mọi dòng của một ảnh (ADR-0060 §3). Một transaction: đọc chưa khoá
   * để biết chủ → khoá chủ theo thứ tự cố định → khoá dòng ảnh, so tập dòng và version → alt bắt
   * buộc → ghi dòng đang khác → chạm `updatedAt` của chủ có dòng vừa đổi. Bust sau commit.
   */
  async update(input: AdminMediaUpdateInput): Promise<AdminMediaItem> {
    const now = new Date();
    const values = {
      alt: input.alt,
      author: input.author,
      license: input.license,
      licenseUrl: input.licenseUrl,
      sourceUrl: input.sourceUrl,
    };

    const outcome = await prisma.$transaction(
      async (tx) => {
        const seen = await tx.mediaAsset.findMany({
          where: { ...USAGE_WHERE, publicId: input.publicId },
          select: { id: true, ownerType: true, ownerId: true },
        });
        const seenRows = seen.flatMap((row) => {
          const { ownerType } = row;
          return isUsageOwner(ownerType) ? [{ ...row, ownerType }] : [];
        });
        if (seenRows.length === 0) throw new MediaNotFoundError(input.publicId);

        // Bước 2: chủ trước, dòng ảnh sau — cùng chiều mọi trình sửa đang có.
        const locked = new Map<string, LockedOwner>();
        for (const group of ownersInLockOrder(seenRows)) {
          for (const owner of await lockOwners(tx, group.ownerType, group.ids)) {
            locked.set(ownerRef(group.ownerType, owner.id), owner);
          }
        }

        // Bước 3: hằng trong SQL chứ không tham số — so cột enum với chuỗi đã gõ kiểu `text`
        // thì Postgres từ chối.
        const lockedIds = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
          SELECT id FROM media_assets
          WHERE public_id = ${input.publicId} AND type = 'IMAGE'
            AND owner_type IN ('TOUR', 'DESTINATION', 'POST', 'SITE')
          ORDER BY id FOR UPDATE`);
        const seenIds = new Set(seenRows.map((row) => row.id));
        if (lockedIds.length !== seenIds.size || lockedIds.some((row) => !seenIds.has(row.id))) {
          throw new StaleMediaError();
        }
        const rows = toLibraryRows(
          await tx.mediaAsset.findMany({
            where: { id: { in: lockedIds.map((row) => row.id) } },
            select: LIBRARY_ROW_SELECT,
          }),
        );
        if (mediaVersion(rows) !== input.version) throw new StaleMediaError();
        if (values.alt === null && mediaAltRequired(rows.map((row) => row.ownerType))) {
          throw new MediaAltRequiredError();
        }

        // Bước 4: không dòng nào khác thì dừng — không ghi, không chạm chủ, không bust.
        const changed = rowsToWrite(rows, values);
        if (changed.length === 0) return { rows: 0, owners: 0, tags: [] as string[] };
        const latest = rows.reduce((max, row) => Math.max(max, row.updatedAt.getTime()), 0);
        await tx.mediaAsset.updateMany({
          where: { id: { in: changed.map((row) => row.id) } },
          // Luôn tăng: hai lần lưu trong một mili-giây vẫn ra hai version.
          data: { ...values, updatedAt: nextTourVersion(new Date(latest).toISOString(), now) },
        });

        // Bước 5: chạm chủ có dòng vừa đổi. Dòng mồ côi (chủ đã xoá) không có gì để chạm.
        const touched = ownersInLockOrder(changed).flatMap((group) =>
          group.ids.flatMap((id) => {
            const owner = locked.get(ownerRef(group.ownerType, id));
            return owner ? [{ ownerType: group.ownerType, owner }] : [];
          }),
        );
        for (const { ownerType, owner } of touched) await touchOwner(tx, ownerType, owner, now);

        const slugsOf = (ownerType: MediaUsageOwner) =>
          touched.flatMap((entry) =>
            entry.ownerType === ownerType && entry.owner.slug !== null ? [entry.owner.slug] : [],
          );
        const destinationIds = touched
          .filter((entry) => entry.ownerType === 'DESTINATION')
          .map((entry) => entry.owner.id);
        const links =
          destinationIds.length === 0
            ? []
            : await tx.tourDestination.findMany({
                where: { destinationId: { in: destinationIds } },
                select: { destinationId: true, tour: { select: { slug: true } } },
              });
        const tags = mediaUpdateTags({
          tourSlugs: slugsOf('TOUR'),
          destinationTourSlugs: destinationIds.map((id) =>
            links.flatMap((link) =>
              // Quan hệ hai bước có thể về `tour: null` khi tour vừa bị xoá — xem `TourLink`.
              link.destinationId === id && link.tour !== null ? [link.tour.slug] : [],
            ),
          ),
          postSlugs: slugsOf('POST'),
          site: touched.some((entry) => entry.ownerType === 'SITE'),
        });
        return { rows: changed.length, owners: touched.length, tags };
      },
      { timeout: 10_000, maxWait: 5_000 },
    );

    this.logger.log(
      `[admin] media updated ${JSON.stringify({
        publicId: input.publicId,
        rows: outcome.rows,
        owners: outcome.owners,
      })}`,
    );
    // `void` có chủ đích — đường này chết thì site chỉ kém tươi, còn lệnh ghi đã ăn rồi.
    if (outcome.tags.length > 0) void this.webRevalidation.revalidate(outcome.tags);
    return this.readItem(input.publicId);
  }

  /**
   * Hàng dọn, chỉ đọc (ADR-0060 §4): mỗi dòng `media_garbage` một trạng thái, phép kiểm còn dùng
   * gộp một câu cho cả hàng, tên chủ một lượt nữa, và job `media-gc` mới nhất.
   */
  async queue(): Promise<AdminMediaQueue> {
    const rows = await prisma.mediaGarbage.findMany({
      select: { publicId: true, resourceType: true, attempts: true, createdAt: true },
      orderBy: [{ createdAt: 'desc' }, { publicId: 'asc' }],
    });
    const rootFolder = env.CLOUDINARY_UPLOAD_FOLDER;
    const refs = rows.flatMap((row) => {
      const parsed = parseUploadZone(rootFolder, row.publicId);
      if (parsed === null) return [];
      const { zone } = parsed;
      return (LOOKUP_ZONES as readonly string[]).includes(zone)
        ? [{ ownerType: zone as MediaUsageOwner, ownerId: parsed.owner }]
        : [];
    });
    const [inUse, owners, lastSweep] = await Promise.all([
      this.stillReferenced(rows.map((row) => row.publicId)),
      this.ownerInfo(refs),
      this.lastSweep(),
    ]);

    return {
      gcEnabled: env.MEDIA_GC_ENABLED,
      graceDays: env.MEDIA_GC_GRACE_DAYS,
      lastSweep,
      rows: rows.map((row) =>
        toQueueRow(row, {
          cloudName: env.CLOUDINARY_CLOUD_NAME,
          rootFolder,
          graceDays: env.MEDIA_GC_GRACE_DAYS,
          inUse,
          owners,
        }),
      ),
    };
  }

  /** Một ảnh sau khi lưu — cùng hình một mục của `list`. */
  private async readItem(publicId: string): Promise<AdminMediaItem> {
    const rows = toLibraryRows(
      await prisma.mediaAsset.findMany({
        where: { ...USAGE_WHERE, publicId },
        select: LIBRARY_ROW_SELECT,
      }),
    );
    // Ảnh vừa bị gỡ khỏi mọi chủ ngay sau commit — hiếm, nhưng không được trả mục rỗng.
    if (rows.length === 0) throw new MediaNotFoundError(publicId);
    return toMediaItem(rows, this.itemContext(await this.ownerInfo(rows)));
  }

  private itemContext(owners: ReadonlyMap<string, OwnerInfo>) {
    return {
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      rootFolder: env.CLOUDINARY_UPLOAD_FOLDER,
      owners,
    };
  }

  /** Tên, slug hay khoá của các chủ — một câu mỗi loại, chạy song song. */
  private async ownerInfo(
    refs: readonly { ownerType: MediaUsageOwner; ownerId: string }[],
  ): Promise<Map<string, OwnerInfo>> {
    const idsOf = (ownerType: MediaUsageOwner) => [
      ...new Set(refs.filter((ref) => ref.ownerType === ownerType).map((ref) => ref.ownerId)),
    ];
    const [tours, destinations, posts, slots] = await Promise.all([
      prisma.tour.findMany({
        where: { id: { in: idsOf('TOUR') } },
        select: { id: true, title: true, slug: true },
      }),
      prisma.destination.findMany({
        where: { id: { in: idsOf('DESTINATION') } },
        select: { id: true, name: true, slug: true },
      }),
      prisma.post.findMany({
        where: { id: { in: idsOf('POST') } },
        select: { id: true, title: true, slug: true },
      }),
      prisma.siteMediaSlot.findMany({
        where: { id: { in: idsOf('SITE') } },
        select: { id: true, key: true },
      }),
    ]);
    return new Map<string, OwnerInfo>([
      ...tours.map(
        (tour) =>
          [ownerRef('TOUR', tour.id), { label: tour.title, slug: tour.slug, key: null }] as const,
      ),
      ...destinations.map(
        (destination) =>
          [
            ownerRef('DESTINATION', destination.id),
            { label: destination.name, slug: destination.slug, key: null },
          ] as const,
      ),
      ...posts.map(
        (post) =>
          [ownerRef('POST', post.id), { label: post.title, slug: post.slug, key: null }] as const,
      ),
      // Khoá khe lạ (đã rời danh mục) vẫn là chủ còn sống, chỉ không có nhãn.
      ...slots.map(
        (slot) =>
          [
            ownerRef('SITE', slot.id),
            { label: null, slug: null, key: isSlotKey(slot.key) ? slot.key : null },
          ] as const,
      ),
    ]);
  }

  /**
   * publicId nào còn được dùng — CÙNG phép kiểm của `sweep` (`stillReferenced`): còn dòng
   * `media_assets`, hay `users.image` chứa chuỗi ấy. Một câu cho cả hàng; `strpos` là `contains`
   * không có ký tự đại diện (`_` trong publicId không thành wildcard của LIKE).
   */
  private async stillReferenced(publicIds: readonly string[]): Promise<ReadonlySet<string>> {
    if (publicIds.length === 0) return new Set();
    const rows = await prisma.$queryRaw<{ public_id: string }[]>(Prisma.sql`
      SELECT g.public_id FROM unnest(${[...publicIds]}::text[]) AS g(public_id)
      WHERE EXISTS (SELECT 1 FROM media_assets m WHERE m.public_id = g.public_id)
         OR EXISTS (SELECT 1 FROM users u WHERE strpos(u.image, g.public_id) > 0)`);
    return new Set(rows.map((row) => row.public_id));
  }

  /**
   * Job `media-gc` mới nhất đã chạy (ADR-0060 §4), đọc thẳng `pgboss.job` — instance pg-boss
   * sống trong `startWorker`, ngoài cây module Nest. Chưa có schema pgboss (DB mới dựng) hay
   * chưa có job nào (máy tắt GC) thì `null`. Job `created` là lượt cron chưa tới giờ, không tính.
   */
  private async lastSweep(): Promise<MediaLastSweep | null> {
    const [schema] = await prisma.$queryRaw<{ present: boolean }[]>(
      Prisma.sql`SELECT to_regclass('pgboss.job') IS NOT NULL AS present`,
    );
    if (!schema?.present) return null;
    const [job] = await prisma.$queryRaw<SweepJobRow[]>(Prisma.sql`
      SELECT state::text AS state, started_on, completed_on, output FROM pgboss.job
      WHERE name = ${MEDIA_GC_QUEUE} AND state IN ('active', 'completed', 'failed', 'cancelled')
      ORDER BY COALESCE(completed_on, started_on, created_on) DESC
      LIMIT 1`);
    if (!job) return null;
    return {
      state: job.state,
      startedAt: job.started_on?.toISOString() ?? null,
      finishedAt: job.completed_on?.toISOString() ?? null,
      report: parseSweepOutput(job.output),
    };
  }
}
