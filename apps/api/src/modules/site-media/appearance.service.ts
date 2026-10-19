import { Injectable, Logger } from '@nestjs/common';
import {
  type AdminAppearanceSetSlotInput,
  type AdminAppearanceSignUploadInput,
  type AdminSiteSlot,
  type MediaItem,
  SITE_SLOT_KEYS,
  SITE_SLOTS,
  type SignedUploadParams,
  type SiteSlotKey,
} from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { env } from '../../config/env.js';
import { Prisma } from '../../generated/prisma/client.js';
import { MediaOwnerType, MediaRole } from '../../generated/prisma/enums.js';
import { buildCloudinaryUrl } from '../../lib/cloudinary-url.js';
import {
  isSiteSlotUploadPublicId,
  requireUploadConfig,
  signUploads,
  siteSlotFolder,
} from '../../lib/upload-signing.js';
import { LIBRARY_PHOTO, STORED_PHOTO_SELECT } from '../catalog/admin-tours.service.js';
import { MediaService } from '../media/media.service.js';
import { MediaGarbageService } from '../media/media-garbage.service.js';
import { siteMediaRevalidationTags } from '../web-revalidation/revalidation-decision.js';
import { WebRevalidationService } from '../web-revalidation/web-revalidation.service.js';
import { SlotPhotoNotAllowedError, StaleSlotError } from './appearance-errors.js';
import {
  nextSlotVersion,
  planSlotImage,
  slotImageSource,
  slotVersion,
  slotVersionMatches,
} from './appearance-rules.js';
import { siteSlotOriginal } from './site-slot-originals.js';

/** Dòng khe đã khoá `FOR UPDATE` — đúng ba cột luật phiên bản cần. */
interface ClaimedSlot {
  id: string;
  created_at: Date;
  updated_at: Date;
}

interface SlotRow {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Tạo dòng khe nếu chưa có (ADR-0059 §3 bước 1). `skipDuplicates` = `ON CONFLICT DO
 * NOTHING`: hai lệnh cùng tạo không đụng nhau, dòng đã có không bị chạm. Hai mốc giờ đặt
 * tường minh và BẰNG nhau — luật "`null` khớp dòng chưa từng lưu" so đúng hai cột này.
 */
async function ensureSlot(
  client: Prisma.TransactionClient | typeof prisma,
  key: SiteSlotKey,
  now: Date,
): Promise<void> {
  await client.siteMediaSlot.createMany({
    data: [{ key, createdAt: now, updatedAt: now }],
    skipDuplicates: true,
  });
}

/**
 * Appearance (ADR-0059) — các thao tác của `admin.appearance.*`.
 *
 * Bust cache web SAU commit, fire-and-forget; lệnh ghi hỏng thì không bust. Đây là đường đầu
 * tiên bắn tag `site-media` (ADR-0016 AMEND 2).
 */
@Injectable()
export class AppearanceService {
  private readonly logger = new Logger(AppearanceService.name);

  constructor(
    private readonly media: MediaService,
    private readonly garbage: MediaGarbageService,
    private readonly webRevalidation: WebRevalidationService,
  ) {}

  /**
   * 47 khe theo thứ tự danh mục. Ba câu cho cả trang: dòng khe, dòng ảnh (cùng đường đọc
   * với web, nên "ảnh đang dùng" là đúng ảnh web đang vẽ), và dòng thư viện của các ảnh ấy.
   */
  async list(): Promise<AdminSiteSlot[]> {
    const rows = await prisma.siteMediaSlot.findMany({
      where: { key: { in: [...SITE_SLOT_KEYS] } },
      select: { id: true, key: true, createdAt: true, updatedAt: true },
    });
    const byKey = new Map(rows.map((row) => [row.key, row]));
    const media = await this.media.resolveForOwners(
      MediaOwnerType.SITE,
      rows.map((row) => row.id),
    );
    const firstIds = rows.flatMap((row) => media.get(row.id)?.[0]?.publicId ?? []);
    const inLibrary = await this.libraryPublicIds(firstIds);

    return SITE_SLOTS.map((slot) => {
      const row = byKey.get(slot.key) ?? null;
      const item = row === null ? null : (media.get(row.id)?.[0] ?? null);
      return this.toSlot(slot.key, row, item, inLibrary);
    });
  }

  /**
   * Ký MỘT lượt tải ảnh vào thư mục của khe (ADR-0059 §5). Khe chưa có dòng thì tạo — thư
   * mục đặt theo `id`. publicId vào hàng dọn NGAY lúc ký (ADR-0035 §3): tải lên rồi không lưu
   * thì bảy ngày sau tự được dọn.
   */
  async signUpload(input: AdminAppearanceSignUploadInput): Promise<SignedUploadParams> {
    const cfg = requireUploadConfig(env);
    await ensureSlot(prisma, input.key, new Date());
    const { id } = await prisma.siteMediaSlot.findUniqueOrThrow({
      where: { key: input.key },
      select: { id: true },
    });

    const { params, publicIds } = signUploads(
      cfg,
      siteSlotFolder(cfg.rootFolder, id),
      1,
      new Date(),
    );
    await this.garbage.enqueueQuietly(publicIds);
    const [signed] = params;
    if (signed === undefined) throw new Error('signUploads trả rỗng cho một lượt ký');
    this.logger.log(`[admin] site slot upload signed ${JSON.stringify({ key: input.key })}`);
    return signed;
  }

  /**
   * Lưu ảnh của một khe (ADR-0059 §3). Một transaction: tạo dòng khe nếu thiếu → khoá
   * `FOR UPDATE` → so phiên bản → phán nguồn (`planSlotImage`) → xoá mọi dòng `SITE` của khe,
   * ghi một dòng → nhích phiên bản → ảnh tải lên bị thay vào lại hàng dọn. Bust sau commit.
   */
  async setSlot(input: AdminAppearanceSetSlotInput): Promise<AdminSiteSlot> {
    const now = new Date();
    const slotId = await prisma.$transaction(async (tx) => {
      await ensureSlot(tx, input.key, now);
      const [slot] = await tx.$queryRaw<ClaimedSlot[]>(Prisma.sql`
        SELECT id, created_at, updated_at FROM site_media_slots
        WHERE key = ${input.key}
        FOR UPDATE
      `);
      if (!slot) throw new Error(`Dòng khe ${input.key} biến mất ngay sau khi tạo`);
      const stamp = { createdAt: slot.created_at, updatedAt: slot.updated_at };
      if (!slotVersionMatches(input.version, stamp)) throw new StaleSlotError();

      const owned = { ownerType: MediaOwnerType.SITE, ownerId: slot.id };
      // MỌI dòng của khe, cùng thứ tự với đường đọc (`resolveForOwners`) — dữ liệu script có
      // thể để lại hai dòng; ảnh admin đang giữ là dòng nào cũng nhận ra (khuôn ảnh bìa bài viết).
      const existing = await tx.mediaAsset.findMany({
        where: owned,
        select: STORED_PHOTO_SELECT,
        orderBy: [{ sortOrder: 'asc' }, { role: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      });
      const current =
        existing.find((row) => row.publicId === input.image.publicId) ?? existing[0] ?? null;
      const library =
        input.image.publicId === current?.publicId
          ? null
          : await tx.mediaAsset.findFirst({
              where: { ...LIBRARY_PHOTO, publicId: input.image.publicId },
              select: STORED_PHOTO_SELECT,
              orderBy: { createdAt: 'asc' },
            });
      const plan = planSlotImage({
        slotId: slot.id,
        rootFolder: env.CLOUDINARY_UPLOAD_FOLDER,
        image: input.image,
        current,
        original: siteSlotOriginal(input.key),
        library,
      });
      if (!plan.ok) throw new SlotPhotoNotAllowedError(plan.rejected);

      // Dòng thừa cũng đi theo deleteMany — ảnh tải lên của chính khe thì vào hàng dọn như
      // ảnh bị thay; ảnh đang giữ thì không.
      const strays = existing
        .filter((row) => row !== current && row.publicId !== input.image.publicId)
        .map((row) => row.publicId)
        .filter((publicId) =>
          isSiteSlotUploadPublicId(env.CLOUDINARY_UPLOAD_FOLDER, slot.id, publicId),
        );
      await tx.mediaAsset.deleteMany({ where: owned });
      await tx.mediaAsset.create({
        data: { ...plan.row, ...owned, role: MediaRole.hero, sortOrder: 0 },
      });
      await tx.siteMediaSlot.update({
        where: { id: slot.id },
        data: { updatedAt: nextSlotVersion(slot.updated_at, now) },
      });
      // Cùng transaction (ADR-0035 §7): rollback thì hàng dọn không giữ dấu vết nào.
      await this.garbage.requeue(tx, [...new Set([...plan.requeue, ...strays])]);
      return slot.id;
    });

    this.logger.log(
      `[admin] site slot saved ${JSON.stringify({ key: input.key, publicId: input.image.publicId })}`,
    );
    // `void` có chủ đích — đường này chết thì site chỉ kém tươi, còn lệnh ghi đã ăn rồi.
    void this.webRevalidation.revalidate(siteMediaRevalidationTags());
    return this.readSlot(input.key, slotId);
  }

  /** Một khe sau khi lưu — cùng hình một dòng của `list`. */
  private async readSlot(key: SiteSlotKey, slotId: string): Promise<AdminSiteSlot> {
    const row = await prisma.siteMediaSlot.findUniqueOrThrow({
      where: { id: slotId },
      select: { id: true, createdAt: true, updatedAt: true },
    });
    const media = await this.media.resolveForOwners(MediaOwnerType.SITE, [slotId]);
    const item = media.get(slotId)?.[0] ?? null;
    const inLibrary = await this.libraryPublicIds(item === null ? [] : [item.publicId]);
    return this.toSlot(key, row, item, inLibrary);
  }

  /** publicId nào trong số này có dòng thư viện — nguồn `LIBRARY`. */
  private async libraryPublicIds(publicIds: readonly string[]): Promise<ReadonlySet<string>> {
    if (publicIds.length === 0) return new Set();
    const rows = await prisma.mediaAsset.findMany({
      where: { ...LIBRARY_PHOTO, publicId: { in: [...publicIds] } },
      select: { publicId: true },
    });
    return new Set(rows.map((row) => row.publicId));
  }

  private toSlot(
    key: SiteSlotKey,
    row: SlotRow | null,
    item: MediaItem | null,
    inLibrary: ReadonlySet<string>,
  ): AdminSiteSlot {
    const original = siteSlotOriginal(key);
    const originalUrl = buildCloudinaryUrl(env.CLOUDINARY_CLOUD_NAME, {
      type: original.type,
      publicId: original.publicId,
      posterId: original.posterId,
      version: original.version,
    }).url;
    return {
      key,
      version: slotVersion(row),
      image:
        item === null || row === null
          ? null
          : {
              publicId: item.publicId,
              url: item.url,
              type: item.type,
              posterUrl: item.posterUrl,
              alt: item.alt,
              width: item.width,
              height: item.height,
              author: item.author,
              license: item.license,
              licenseUrl: item.licenseUrl,
              sourceUrl: item.sourceUrl,
              source: slotImageSource(item.publicId, {
                rootFolder: env.CLOUDINARY_UPLOAD_FOLDER,
                slotId: row.id,
                originalPublicId: original.publicId,
                inLibrary: inLibrary.has(item.publicId),
              }),
            },
      original: {
        publicId: original.publicId,
        url: originalUrl,
        alt: original.alt,
        width: original.width,
        height: original.height,
      },
    };
  }
}
