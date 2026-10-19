import { z } from 'zod';
import {
  SITE_IMAGE_SLOT_KEYS,
  SITE_SLOT_KEYS,
  type SiteImageSlotKey,
  type SiteSlotKey,
} from '../site-slots.js';
import { TourPhotoUploadSchema } from './admin-tours.js';
import { descriptionSchema } from './common.js';
import { MediaPublicIdSchema } from './media.js';

/**
 * Appearance (spec P4f 15/10, ADR-0059) — ba thủ tục của `admin.appearance.*`: đọc 47 khe,
 * ký tải ảnh vào thư mục của một khe, lưu ảnh của một khe. Khoá khe đi qua `z.enum` dựng từ
 * danh mục, nên khoá lạ và khe video chết ngay ở tầng dạng (400), không tới service.
 */

/** Cột `media_assets.alt VarChar(300)` — cùng cột với alt của ảnh tour và ảnh bìa bài viết. */
export const SITE_SLOT_ALT_MAX = 300;

export const SiteSlotKeySchema = z.enum(SITE_SLOT_KEYS as [SiteSlotKey, ...SiteSlotKey[]]);

/** Khe NHẬN ảnh: khe video `about-cta-video` chỉ xem (spec §1), nên không có ở đây. */
export const SiteImageSlotKeySchema = z.enum(
  SITE_IMAGE_SLOT_KEYS as [SiteImageSlotKey, ...SiteImageSlotKey[]],
);

/** Phiên bản = `updatedAt` của dòng khe; `null` khi khe chưa có dòng (ADR-0059 §3). */
const SlotVersionSchema = z.iso.datetime().nullable();

/**
 * Nguồn của ảnh đang dùng (ADR-0059 §2): `ORIGINAL` là ảnh gốc trong bảng của API,
 * `UPLOAD` là thư mục tải lên của chính khe, `LIBRARY` là ảnh có dòng thư viện địa danh,
 * `OTHER` là dòng script ghi mà không khớp nguồn nào.
 */
export const SiteSlotImageSourceSchema = z.enum(['ORIGINAL', 'UPLOAD', 'LIBRARY', 'OTHER']);
export type SiteSlotImageSource = z.output<typeof SiteSlotImageSourceSchema>;

// ── Đọc ─────────────────────────────────────────────────────────────────────

export const AdminSiteSlotImageSchema = z.object({
  publicId: z.string().min(1),
  url: z.url(),
  type: z.enum(['IMAGE', 'VIDEO']),
  /** Ảnh poster của khe video; `null` với ảnh. */
  posterUrl: z.url().nullable(),
  alt: z.string().nullable(),
  width: z.int().positive().nullable(),
  height: z.int().positive().nullable(),
  author: z.string().nullable(),
  license: z.string().nullable(),
  licenseUrl: z.url().nullable(),
  sourceUrl: z.url().nullable(),
  source: SiteSlotImageSourceSchema,
});
export type AdminSiteSlotImage = z.output<typeof AdminSiteSlotImageSchema>;

/** Ảnh gốc của khe — Restore original gửi lại `publicId` và `alt` này. */
export const AdminSiteSlotOriginalSchema = z.object({
  publicId: z.string().min(1),
  url: z.url(),
  alt: z.string().nullable(),
  width: z.int().positive().nullable(),
  height: z.int().positive().nullable(),
});
export type AdminSiteSlotOriginal = z.output<typeof AdminSiteSlotOriginalSchema>;

/** Một khe của `list`, cũng là thứ `setSlot` trả sau khi lưu. Nhóm và khung đọc ở danh mục. */
export const AdminSiteSlotSchema = z.object({
  key: SiteSlotKeySchema,
  version: SlotVersionSchema,
  /** `null` khi khe chưa có ảnh (DB mới dựng) — web vẽ ô giữ chỗ. */
  image: AdminSiteSlotImageSchema.nullable(),
  original: AdminSiteSlotOriginalSchema,
});
export type AdminSiteSlot = z.output<typeof AdminSiteSlotSchema>;

// ── Ghi ─────────────────────────────────────────────────────────────────────

export const AdminAppearanceSignUploadInputSchema = z.object({ key: SiteImageSlotKeySchema });
export type AdminAppearanceSignUploadInput = z.output<typeof AdminAppearanceSignUploadInputSchema>;

export const AdminSiteSlotImageInputSchema = z.object({
  publicId: MediaPublicIdSchema,
  /** Tuỳ chọn: trống là ảnh trang trí — web vẽ `alt=""` như hôm nay (spec §5). */
  alt: descriptionSchema(SITE_SLOT_ALT_MAX),
  /** Metadata Cloudinary của ảnh MỚI tải (ADR-0048 §5) — cùng hình với ảnh tour. */
  upload: TourPhotoUploadSchema.optional(),
});
export type AdminSiteSlotImageInput = z.output<typeof AdminSiteSlotImageInputSchema>;

export const AdminAppearanceSetSlotInputSchema = z.object({
  key: SiteImageSlotKeySchema,
  version: SlotVersionSchema,
  image: AdminSiteSlotImageInputSchema,
});
export type AdminAppearanceSetSlotInput = z.output<typeof AdminAppearanceSetSlotInputSchema>;
