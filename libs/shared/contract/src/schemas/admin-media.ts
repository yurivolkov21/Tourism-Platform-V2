import { z } from 'zod';
import { SiteSlotKeySchema } from './admin-appearance.js';
import { MediaPublicIdSchema } from './media.js';

/**
 * Media library (spec P4f 16/10, ADR-0060) — ba thủ tục của `admin.media.*`: gom mọi chỗ dùng của
 * từng ảnh, sửa alt và ghi công một lần cho mọi chỗ dùng, đọc hàng dọn. Luật alt bắt buộc và cờ cần
 * chú ý nằm ở đây để API (chặn lưu) và admin (lọc, cảnh báo) dùng chung một bản.
 */

/** Độ dài theo cột `media_assets` (ADR-0060 §3). */
export const MEDIA_ALT_MAX = 300;
export const MEDIA_AUTHOR_MAX = 200;
export const MEDIA_LICENSE_MAX = 60;
export const MEDIA_LICENSE_URL_MAX = 300;
export const MEDIA_SOURCE_URL_MAX = 500;

// ── Luật thuần ──────────────────────────────────────────────────────────────

/** Bốn loại chủ là chỗ dùng của trang này; REVIEW và avatar chỉ hiện ở hàng dọn (ADR-0060 §1). */
export const MediaUsageOwnerSchema = z.enum(['TOUR', 'DESTINATION', 'POST', 'SITE']);
export type MediaUsageOwner = z.output<typeof MediaUsageOwnerSchema>;

/**
 * Họ CC BY (CC BY, CC BY-SA, CC BY-NC…) đòi cả tác giả lẫn link giấy phép. Chuỗi giấy phép giữ
 * nguyên văn nguồn công bố (ADR-0020), nên so tiền tố, không so bằng: `CC0` và `Public domain`
 * không đòi gì, `CC-BY` là cách viết khác của cùng họ.
 */
export function isCcByLicense(license: string | null): boolean {
  if (license === null) return false;
  return /^cc[\s-]by\b/i.test(license.trim());
}

/** Alt bắt buộc khi ảnh có chỗ dùng ở tour hay thư viện điểm đến (luật tab Photos, ADR-0048). */
export function mediaAltRequired(ownerTypes: readonly MediaUsageOwner[]): boolean {
  return ownerTypes.includes('TOUR') || ownerTypes.includes('DESTINATION');
}

export const MediaAttentionSchema = z.enum(['MISSING_ALT', 'CREDIT_INCOMPLETE']);
export type MediaAttention = z.output<typeof MediaAttentionSchema>;

const isBlank = (value: string | null): boolean => value === null || value.trim() === '';

/**
 * Việc cần chú ý của một ảnh, thứ tự cố định. `alts` là alt của MỌI dòng: một dòng trống là đủ,
 * vì web vẽ đúng dòng ấy. "Không có thông tin nguồn" không phải cờ ở đây mà là bộ lọc riêng của
 * admin (ADR-0060 §1).
 */
export function mediaAttention(input: {
  altRequired: boolean;
  alts: readonly (string | null)[];
  author: string | null;
  license: string | null;
  licenseUrl: string | null;
}): MediaAttention[] {
  const flags: MediaAttention[] = [];
  if (input.altRequired && input.alts.some(isBlank)) flags.push('MISSING_ALT');
  if (isCcByLicense(input.license) && (isBlank(input.author) || isBlank(input.licenseUrl))) {
    flags.push('CREDIT_INCOMPLETE');
  }
  return flags;
}

// ── Đọc: tab In use ─────────────────────────────────────────────────────────

/** `UPLOAD` khi publicId nằm trong vùng tải lên của API, còn lại là ảnh catalog. */
export const MediaSourceSchema = z.enum(['UPLOAD', 'CATALOG']);
export type MediaSource = z.output<typeof MediaSourceSchema>;

/**
 * Version của ảnh: `<số dòng>:<updatedAt lớn nhất>` trên mọi dòng (ADR-0060 §1). Đổi khi ai đó
 * sửa alt hay ghi công, và khi một chủ mượn thêm hay gỡ ảnh.
 */
const MediaVersionSchema = z.string().regex(/^\d+:\d{4}-\d{2}-\d{2}T[\d:.]+Z$/);

/** Một chỗ dùng: một dòng `media_assets`. */
export const MediaUsageSchema = z.object({
  ownerType: MediaUsageOwnerSchema,
  ownerId: z.uuid(),
  /** Tên tour, tên điểm đến, tiêu đề bài; `null` với khe (admin dựng nhãn từ chữ Appearance). */
  label: z.string().nullable(),
  /** Slug để dựng link tới trình sửa; `null` với khe. */
  slug: z.string().nullable(),
  /** Khoá khe; `null` với ba loại chủ còn lại. */
  key: SiteSlotKeySchema.nullable(),
  role: z.enum(['hero', 'gallery', 'avatar', 'body']),
  sortOrder: z.int().nonnegative(),
  /** Alt riêng của dòng này — admin dùng khi các dòng lệch nhau. */
  alt: z.string().nullable(),
});
export type MediaUsage = z.output<typeof MediaUsageSchema>;

/** Bốn ô ghi công của một dòng (ADR-0020). */
export const MediaCreditSchema = z.object({
  author: z.string().nullable(),
  license: z.string().nullable(),
  licenseUrl: z.url().nullable(),
  sourceUrl: z.url().nullable(),
});
export type MediaCredit = z.output<typeof MediaCreditSchema>;

/**
 * Một ảnh của `list`, cũng là thứ `update` trả sau khi lưu. Alt và ghi công là giá trị chung khi
 * mọi dòng giống nhau; khi lệch thì lấy của dòng thư viện, không có thì dòng cũ nhất, kèm cờ
 * `altVaries` hay `creditVaries` và các bản đang khác (ADR-0060 §2).
 */
export const AdminMediaItemSchema = z.object({
  publicId: z.string().min(1),
  url: z.url(),
  /** Số đo lấy từ dòng có số (ưu tiên thư viện); dòng tour mượn không có số. */
  width: z.int().positive().nullable(),
  height: z.int().positive().nullable(),
  bytes: z.int().positive().nullable(),
  format: z.string().nullable(),
  alt: z.string().nullable(),
  altVaries: z.boolean(),
  altRequired: z.boolean(),
  author: z.string().nullable(),
  license: z.string().nullable(),
  licenseUrl: z.url().nullable(),
  sourceUrl: z.url().nullable(),
  creditVaries: z.boolean(),
  /** Mọi bản ghi công khác nhau đang có, kể cả bản đang hiện; rỗng khi không lệch. */
  creditVariants: z.array(MediaCreditSchema),
  source: MediaSourceSchema,
  usages: z.array(MediaUsageSchema).min(1),
  attention: z.array(MediaAttentionSchema),
  version: MediaVersionSchema,
});
export type AdminMediaItem = z.output<typeof AdminMediaItemSchema>;

// ── Ghi ─────────────────────────────────────────────────────────────────────

/** Chữ tuỳ chọn: cắt khoảng trắng, rỗng thành `null`. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .transform((value) => (value === null || value === '' ? null : value));

/** Link tuỳ chọn: như chữ, rồi phải là URL `http` hay `https` (chặn `javascript:` trong `href`). */
const optionalLink = (max: number) =>
  optionalText(max).pipe(z.url({ protocol: /^https?$/ }).nullable());

export const AdminMediaUpdateInputSchema = z.object({
  publicId: MediaPublicIdSchema,
  version: MediaVersionSchema,
  /** Bắt buộc hay không phán ở API trên tập chỗ dùng đã khoá (ADR-0060 §3). */
  alt: optionalText(MEDIA_ALT_MAX),
  author: optionalText(MEDIA_AUTHOR_MAX),
  license: optionalText(MEDIA_LICENSE_MAX),
  licenseUrl: optionalLink(MEDIA_LICENSE_URL_MAX),
  sourceUrl: optionalLink(MEDIA_SOURCE_URL_MAX),
});
export type AdminMediaUpdateInput = z.output<typeof AdminMediaUpdateInputSchema>;

// ── Đọc: tab Cleanup queue ──────────────────────────────────────────────────

/** Trạng thái một dòng `media_garbage`, xét theo đúng thứ tự `sweep` xét (ADR-0060 §4). */
export const MediaQueueStateSchema = z.enum(['REFUSED', 'GAVE_UP', 'IN_USE', 'WAITING']);
export type MediaQueueState = z.output<typeof MediaQueueStateSchema>;

/** Vùng tải lên suy từ đường dẫn; `null` khi publicId ngoài vùng (dòng `REFUSED`). */
export const MediaUploadZoneSchema = z.enum([
  'TOUR',
  'POST',
  'SITE',
  'DESTINATION',
  'REVIEW',
  'AVATAR',
]);
export type MediaUploadZone = z.output<typeof MediaUploadZoneSchema>;

export const AdminMediaQueueRowSchema = z.object({
  publicId: z.string().min(1),
  /** Ảnh thu nhỏ; luôn `null` với avatar (không lộ ảnh khách). */
  url: z.url().nullable(),
  zone: MediaUploadZoneSchema.nullable(),
  /** Tên tour, tiêu đề bài, tên điểm đến hay mã booking; `null` khi chủ đã xoá, với khe và avatar. */
  ownerLabel: z.string().nullable(),
  /** Slug để link tới trình sửa của chủ còn sống. */
  ownerSlug: z.string().nullable(),
  /** Khoá khe khi vùng là `SITE` và khe còn trong danh mục. */
  slotKey: SiteSlotKeySchema.nullable(),
  /** Chủ dạng uuid không còn trong DB: admin ghi "Deleted tour" và tương tự. */
  ownerDeleted: z.boolean(),
  state: MediaQueueStateSchema,
  queuedAt: z.iso.datetime(),
  /** Ngày sớm nhất lượt dọn có thể xoá; chỉ có với `WAITING`. */
  dueAt: z.iso.datetime().nullable(),
  attempts: z.int().nonnegative(),
});
export type AdminMediaQueueRow = z.output<typeof AdminMediaQueueRowSchema>;

/** Sáu số của `SweepReport` (ADR-0035) — output của job `media-gc` từ bản này. */
export const MediaSweepReportSchema = z.object({
  resolved: z.int().nonnegative(),
  destroyed: z.int().nonnegative(),
  absent: z.int().nonnegative(),
  deferred: z.int().nonnegative(),
  failed: z.int().nonnegative(),
  refused: z.int().nonnegative(),
});
export type MediaSweepReport = z.output<typeof MediaSweepReportSchema>;

export const MediaLastSweepSchema = z.object({
  /** Sáu trạng thái job của pg-boss 12. */
  state: z.enum(['created', 'retry', 'active', 'completed', 'cancelled', 'failed']),
  startedAt: z.iso.datetime().nullable(),
  finishedAt: z.iso.datetime().nullable(),
  /** `null` với job chạy trước bản này (output rỗng) hay output không đúng hình. */
  report: MediaSweepReportSchema.nullable(),
});
export type MediaLastSweep = z.output<typeof MediaLastSweepSchema>;

export const AdminMediaQueueSchema = z.object({
  gcEnabled: z.boolean(),
  graceDays: z.int().positive(),
  /** `null` khi chưa có schema hay queue `media-gc` (máy dev, nơi GC tắt). */
  lastSweep: MediaLastSweepSchema.nullable(),
  rows: z.array(AdminMediaQueueRowSchema),
});
export type AdminMediaQueue = z.output<typeof AdminMediaQueueSchema>;
