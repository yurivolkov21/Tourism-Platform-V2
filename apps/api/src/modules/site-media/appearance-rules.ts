import type { AdminSiteSlotImageInput, SiteSlotImageSource } from '@tourism/contract';
import { isSiteSlotUploadPublicId } from '../../lib/upload-signing.js';
import { nextTourVersion } from '../catalog/tour-editor-rules.js';
import type { StoredPhoto } from '../catalog/tour-photos.js';
import type { SiteSlotOriginal } from './site-slot-originals.js';

/**
 * Logic THUẦN của Appearance (ADR-0059) — nguồn của một lần lưu, nguồn của ảnh đang dùng,
 * luật phiên bản của dòng khe. Ngoài DB nên test được từng nhánh; service chỉ còn
 * orchestration.
 */

/** Một dòng ảnh của khe sẽ ghi — cột chép từ nguồn, `alt` theo form (trống là `null`). */
export interface PlannedSlotRow extends StoredPhoto {
  alt: string | null;
}

export type SlotImagePlan =
  | { ok: true; row: PlannedSlotRow; requeue: string[] }
  | { ok: false; rejected: string };

/**
 * Ảnh gửi lên → dòng sẽ ghi và ảnh phải vào lại hàng dọn (ADR-0059 §2–3).
 *
 * Ảnh thuộc đúng MỘT nguồn, xét theo thứ tự: ảnh ĐANG DÙNG (giữ, chỉ đổi alt) → ảnh TẢI
 * LÊN trong thư mục của khe, có metadata (mới) → ảnh GỐC của khe (chép từ bảng) → dòng
 * THƯ VIỆN loại ảnh (mượn, chép ghi công). Không thuộc nguồn nào là từ chối cả lệnh: chuỗi
 * này là đối số của một lệnh destroy sau này (ADR-0035).
 *
 * Ảnh cũ bị thay chỉ vào lại hàng dọn khi nó nằm trong thư mục tải lên của chính khe — ảnh
 * gốc và ảnh thư viện không bao giờ.
 */
export function planSlotImage(args: {
  slotId: string;
  rootFolder: string;
  image: AdminSiteSlotImageInput;
  /** Dòng ảnh hiện có của khe (dòng đầu theo thứ tự đọc của web), hoặc `null`. */
  current: StoredPhoto | null;
  original: SiteSlotOriginal;
  /** Dòng `DESTINATION` của publicId gửi lên, nếu có. */
  library: StoredPhoto | null;
}): SlotImagePlan {
  const { image } = args;
  const requeue =
    args.current !== null &&
    args.current.publicId !== image.publicId &&
    isSiteSlotUploadPublicId(args.rootFolder, args.slotId, args.current.publicId)
      ? [args.current.publicId]
      : [];

  const source =
    (args.current?.publicId === image.publicId ? args.current : null) ??
    uploadedImage(args.rootFolder, args.slotId, image) ??
    (args.original.publicId === image.publicId ? storedOf(args.original) : null) ??
    (args.library?.publicId === image.publicId && args.library.type === 'IMAGE'
      ? args.library
      : null);
  if (source === null) return { ok: false, rejected: image.publicId };
  return { ok: true, row: { ...source, alt: image.alt }, requeue };
}

/** Bỏ `alt` gợi ý của bảng ảnh gốc — alt của dòng ghi luôn theo form. */
function storedOf({ alt: _alt, ...stored }: SiteSlotOriginal): StoredPhoto {
  return stored;
}

/** Ảnh tải lên MỚI: đúng thư mục của khe VÀ có metadata Cloudinary — thiếu một là không nhận. */
function uploadedImage(
  rootFolder: string,
  slotId: string,
  image: AdminSiteSlotImageInput,
): StoredPhoto | null {
  if (image.upload === undefined) return null;
  if (!isSiteSlotUploadPublicId(rootFolder, slotId, image.publicId)) return null;
  return {
    publicId: image.publicId,
    type: 'IMAGE',
    posterId: null,
    format: image.upload.format,
    width: image.upload.width,
    height: image.upload.height,
    durationSec: null,
    bytes: image.upload.bytes,
    version: image.upload.version,
    author: null,
    license: null,
    licenseUrl: null,
    sourceUrl: null,
  };
}

/**
 * Nguồn của ảnh đang dùng mà `list` trả (ADR-0059 §2). Ảnh gốc xét trước: hôm sinh bảng, 0
 * ảnh site nào có dòng thư viện, nên thứ tự chỉ quan trọng nếu sau này ai đó thêm.
 */
export function slotImageSource(
  publicId: string,
  args: { rootFolder: string; slotId: string; originalPublicId: string; inLibrary: boolean },
): SiteSlotImageSource {
  if (publicId === args.originalPublicId) return 'ORIGINAL';
  if (isSiteSlotUploadPublicId(args.rootFolder, args.slotId, publicId)) return 'UPLOAD';
  return args.inLibrary ? 'LIBRARY' : 'OTHER';
}

interface SlotStamp {
  createdAt: Date;
  updatedAt: Date;
}

/** Phiên bản `list` trả: `updatedAt` dạng ISO, hoặc `null` khi khe chưa có dòng. */
export function slotVersion(row: SlotStamp | null): string | null {
  return row === null ? null : row.updatedAt.toISOString();
}

/**
 * Phiên bản form đang cầm còn khớp dòng khe không (ADR-0059 §3). `null` khớp dòng CHƯA TỪNG
 * được lưu (`updatedAt = createdAt`): `signUpload` có thể vừa tạo dòng giữa lúc admin mở
 * trang và lúc bấm lưu, và lần lưu đầu tiên không được vì thế thành `STALE_SLOT`.
 */
export function slotVersionMatches(version: string | null, row: SlotStamp): boolean {
  if (version === null) return row.updatedAt.getTime() === row.createdAt.getTime();
  return Date.parse(version) === row.updatedAt.getTime();
}

/** Cùng luật nhích phiên bản với tour và bài viết: hai lần lưu trong một mili-giây vẫn ra hai. */
export function nextSlotVersion(updatedAt: Date, now: Date): Date {
  return nextTourVersion(updatedAt.toISOString(), now);
}
