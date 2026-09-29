import {
  type AdminLibraryPhoto,
  type AdminPhotoLibrary,
  type AdminTourDetail,
  type AdminTourPhotosInput,
  type AdminTourSignPhotoUploadsInput,
  type SignedUploadParams,
  TOUR_PHOTO_ALT_MAX,
  TOUR_PHOTO_MAX_BYTES,
  TOUR_PHOTOS_MAX,
  type TourPhotoSource,
  type TourPhotoUpload,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { createWriteErrorCodec, type TransportFailureCode } from './api/write-error';
import { cloudinaryImageUrl } from './cloudinary-url';
import { type Keyed, newItemKey } from './list-editor';
import { imageExtensionOf, type UploadedPhoto } from './photo-upload';
import { onSaleShortfalls, projectedReadiness } from './tour-editor-view';
import type { EditorWriteResult } from './tour-editor-write';

/**
 * Logic THUẦN của tab Photos (spec F18 §2g, ADR-0048): codec lỗi, hợp đồng của ba
 * server action, giá trị form, kiểm trước khi gửi, payload, lọc file, sức chứa.
 */
const e = messages.admin.tours.editor;
const t = e.photos;

const photosCodec = createWriteErrorCodec(t.errors);
/**
 * Ký là lệnh chưa đụng gì: kết cục không rõ ở đây không có gì để "lỡ đi qua", nên
 * câu GENERIC là câu riêng thay vì giọng ghi chung (`transportCopy`, khuôn F8).
 */
const signCodec = createWriteErrorCodec(t.signErrors, { transportCopy: { GENERIC: t.signFailed } });

export type PhotosContractCode = keyof typeof t.errors;
export type SignUploadsContractCode = keyof typeof t.signErrors;
export const PHOTOS_CONTRACT_CODES = photosCodec.codes;
export const SIGN_UPLOADS_CONTRACT_CODES = signCodec.codes;
export const classifyPhotosError = photosCodec.classify;
export const photosErrorCopy = photosCodec.copy;
export const classifySignUploadsError = signCodec.classify;
export const signUploadsErrorCopy = signCodec.copy;

/** Số file tải song song — đủ nhanh mà không bóp băng thông của một máy admin. */
export const UPLOAD_CONCURRENCY = 3;

// ── Hợp đồng vận chuyển của server action ──────────────────────────────────

export type SetPhotosAction = (
  input: AdminTourPhotosInput,
) => Promise<EditorWriteResult<PhotosContractCode>>;

export type SignPhotoUploadsResult =
  | { ok: true; params: SignedUploadParams[] }
  | { ok: false; code: SignUploadsContractCode | TransportFailureCode };
export type SignPhotoUploadsAction = (
  input: AdminTourSignPhotoUploadsInput,
) => Promise<SignPhotoUploadsResult>;

export type PhotoLibraryResult =
  | { ok: true; library: AdminPhotoLibrary }
  | { ok: false; code: TransportFailureCode };
export type LoadPhotoLibraryAction = () => Promise<PhotoLibraryResult>;

/**
 * Câu lỗi tải kho ảnh theo mã — giọng ĐỌC (vòng review F18). Thủ tục không có input nên
 * INVALID_INPUT không thể tới; nếu tới thì cũng chỉ là lỗi chung.
 */
export function libraryLoadErrorCopy(code: TransportFailureCode): string {
  return t.dialog.loadErrors[code === 'INVALID_INPUT' ? 'GENERIC' : code];
}

// ── Giá trị form ────────────────────────────────────────────────────────────

export interface PhotoDraft extends Keyed {
  publicId: string;
  /** URL delivery `f_auto,q_auto` — thumbnail dựng từ nó (`tourPhotoThumb`). */
  url: string;
  alt: string;
  source: TourPhotoSource;
  author: string | null;
  license: string | null;
  /** Chỉ ảnh VỪA tải lên trong lần sửa này — metadata Cloudinary trả về. */
  upload?: TourPhotoUpload;
}

export interface PhotosFormValues {
  photos: PhotoDraft[];
}

export interface PhotosFormErrors {
  /** Lỗi của CẢ danh sách (tour đang bán gỡ hết ảnh). */
  list?: string;
  /** Lỗi ô alt, khoá theo `key` của dòng. */
  rows: Record<string, string>;
}

/** Key tất định theo vị trí (bài học 12) — form dựng hai lần, SSR rồi hydrate. */
export function photosFormValues(detail: AdminTourDetail): PhotosFormValues {
  return {
    photos: detail.photos.map((photo, index) => ({
      key: `photo-${index}`,
      publicId: photo.publicId,
      url: photo.url,
      alt: photo.alt ?? '',
      source: photo.source,
      author: photo.author,
      license: photo.license,
    })),
  };
}

export function validatePhotosForm(
  values: PhotosFormValues,
  detail: AdminTourDetail,
): PhotosFormErrors {
  const rows: Record<string, string> = {};
  // Hai luật soi gương contract (vòng review F18): một publicId chỉ một lần, và không
  // quá `TOUR_PHOTOS_MAX` ảnh — lọt tới server là INVALID_INPUT, admin không biết sửa gì.
  const seen = new Set<string>();
  for (const photo of values.photos) {
    const alt = photo.alt.trim();
    if (seen.has(photo.publicId)) rows[photo.key] = t.duplicate;
    else if (alt === '') rows[photo.key] = t.altRequired;
    else if (alt.length > TOUR_PHOTO_ALT_MAX) {
      rows[photo.key] = e.form.errors.tooLong(TOUR_PHOTO_ALT_MAX);
    }
    seen.add(photo.publicId);
  }
  const extra = values.photos.length - TOUR_PHOTOS_MAX;
  if (extra > 0) return { list: e.form.errors.tooManyPhotos(TOUR_PHOTOS_MAX, extra), rows };
  // G11: luật "tour đang bán" suy từ readiness dự tính (ADR-0048 §8).
  const shortfalls = onSaleShortfalls(
    detail,
    projectedReadiness(detail, { photoCount: values.photos.length }),
  );
  return shortfalls.cover ? { list: e.form.errors.photosOnSale, rows } : { rows };
}

export function hasPhotoErrors(errors: PhotosFormErrors): boolean {
  return errors.list !== undefined || Object.keys(errors.rows).length > 0;
}

/** Giá trị form → input `setPhotos`. Gọi SAU khi kiểm đã sạch. */
export function photosPayload(
  id: string,
  version: string,
  values: PhotosFormValues,
): AdminTourPhotosInput {
  return {
    id,
    version,
    photos: values.photos.map((photo) => ({
      publicId: photo.publicId,
      alt: photo.alt.trim(),
      ...(photo.upload ? { upload: photo.upload } : {}),
    })),
  };
}

/** Đưa một ảnh lên đầu — ảnh bìa (ADR-0048 §1). Key lạ trả nguyên giá trị. */
export function makeCover(values: PhotosFormValues, key: string): PhotosFormValues {
  const photo = values.photos.find((item) => item.key === key);
  if (!photo) return values;
  return { photos: [photo, ...values.photos.filter((item) => item.key !== key)] };
}

// ── Tải lên ─────────────────────────────────────────────────────────────────

/** Chỗ còn trống: 30 trừ ảnh đang có trừ file đang tải (hỏng cũng giữ chỗ tới khi gỡ). */
export function remainingCapacity(photoCount: number, uploadCount: number): number {
  return Math.max(0, TOUR_PHOTOS_MAX - photoCount - uploadCount);
}

export interface SkippedFile {
  name: string;
  reason: 'type' | 'size' | 'full';
}

/** Lọc file trước khi ký: đuôi, dung lượng, rồi sức chứa — theo thứ tự admin chọn. */
export function acceptFiles(
  files: readonly File[],
  capacity: number,
): { accepted: File[]; skipped: SkippedFile[] } {
  const accepted: File[] = [];
  const skipped: SkippedFile[] = [];
  for (const file of files) {
    if (imageExtensionOf(file.name) === null) skipped.push({ name: file.name, reason: 'type' });
    else if (file.size > TOUR_PHOTO_MAX_BYTES) skipped.push({ name: file.name, reason: 'size' });
    else if (accepted.length >= capacity) skipped.push({ name: file.name, reason: 'full' });
    else accepted.push(file);
  }
  return { accepted, skipped };
}

export function skippedCopy(file: SkippedFile): string {
  return t.skipped[file.reason](file.name);
}

/** Ảnh vừa tải → dòng mới; alt để trống, admin phải điền trước khi lưu. */
export function uploadedPhotoDraft(uploaded: UploadedPhoto, cloudName: string): PhotoDraft {
  return {
    key: newItemKey(),
    publicId: uploaded.publicId,
    url: cloudinaryImageUrl(cloudName, uploaded.publicId, uploaded.upload.version),
    alt: '',
    source: 'UPLOAD',
    author: null,
    license: null,
    upload: uploaded.upload,
  };
}

/** Ảnh thư viện → dòng mới; alt chép từ ảnh gốc (sửa được), ghi công đi theo để hiển thị. */
export function libraryPhotoDraft(photo: AdminLibraryPhoto): PhotoDraft {
  return {
    key: newItemKey(),
    publicId: photo.publicId,
    url: photo.url,
    alt: photo.alt ?? '',
    source: 'LIBRARY',
    author: photo.author,
    license: photo.license,
  };
}

/**
 * Dòng nguồn dưới ô alt — quyết định 1 của plan F18: không kèm tên địa danh. Ảnh bìa
 * gốc (`CATALOG`) nói thêm rằng gỡ ra thì không thêm lại được (ADR-0048 AMEND 1).
 */
export function photoSourceLine(photo: PhotoDraft): string {
  if (photo.source === 'UPLOAD') return t.uploaded;
  const credit = photo.author === null ? [] : [t.credit(photo.author, photo.license)];
  if (photo.source === 'CATALOG') return [t.catalogue, ...credit, t.catalogueWarning].join(' · ');
  return [t.fromLibrary, ...credit].join(' · ');
}

/**
 * Chạy mọi việc, không quá `limit` việc cùng lúc; lỗi của một việc do chính nó bắt.
 * `signal` huỷ thì thôi khởi động việc mới — rời tab lúc đang tải không tải tiếp hàng
 * đợi (vòng review F18); việc đang chạy do chính nó nghe `signal`.
 */
export async function runWithConcurrency(
  tasks: readonly (() => Promise<void>)[],
  limit: number,
  signal?: AbortSignal,
): Promise<void> {
  let next = 0;
  const lane = async () => {
    while (next < tasks.length && !signal?.aborted) {
      const task = tasks[next];
      next += 1;
      if (task) await task();
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, tasks.length) }, lane));
}
