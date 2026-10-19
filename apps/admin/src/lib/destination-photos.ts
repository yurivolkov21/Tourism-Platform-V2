import {
  type AdminDestinationPhotos,
  type AdminDestinationSetPhotosInput,
  type AdminDestinationSignPhotoUploadsInput,
  DESTINATION_PHOTOS_MAX,
  type MediaSource,
  TOUR_PHOTO_ALT_MAX,
  type TourPhotoUpload,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { createWriteErrorCodec, type TransportFailureCode } from './api/write-error';
import { cloudinaryImageUrl } from './cloudinary-url';
import { type Keyed, newItemKey } from './list-editor';
import type { UploadedPhoto } from './photo-upload';
import type { SignPhotoUploadsResult, SkippedFile } from './tour-photos';

/**
 * Logic THUẦN của trang Photos một điểm đến (spec P4f Media §7, ADR-0060 §8): codec lỗi, hợp
 * đồng của hai server action, giá trị form, kiểm trước khi gửi, payload, dòng nguồn và câu hậu
 * quả khi gỡ. Khuôn `tour-photos.ts`; khác ở hai chỗ: chỉ hai nguồn (không có ảnh thư viện —
 * thư viện chính là trang này), và gỡ ảnh nói ra hậu quả vì ảnh rời cả thư viện.
 */
const t = messages.admin.destinations.photos;
const photosCopy = messages.admin.tours.editor.photos;
const formErrors = messages.admin.tours.editor.form.errors;

const setPhotosCodec = createWriteErrorCodec(t.errors);
/** Ký là lệnh chưa đụng gì — câu GENERIC riêng của việc tải, như tab Photos của tour. */
const signCodec = createWriteErrorCodec(t.signErrors, {
  transportCopy: { GENERIC: photosCopy.signFailed },
});

export type SetDestinationPhotosCode = keyof typeof t.errors;
export type SignDestinationUploadsCode = keyof typeof t.signErrors;
export const SET_DESTINATION_PHOTOS_CODES = setPhotosCodec.codes;
export const SIGN_DESTINATION_UPLOADS_CODES = signCodec.codes;
export const classifySetDestinationPhotosError = setPhotosCodec.classify;
export const setDestinationPhotosErrorCopy = setPhotosCodec.copy;
export const classifySignDestinationUploadsError = signCodec.classify;
export const signDestinationUploadsErrorCopy = signCodec.copy;

// ── Hợp đồng vận chuyển của server action ──────────────────────────────────

export type SetDestinationPhotosResult =
  | { ok: true; detail: AdminDestinationPhotos }
  | { ok: false; code: SetDestinationPhotosCode | TransportFailureCode };
export type SetDestinationPhotosAction = (
  input: AdminDestinationSetPhotosInput,
) => Promise<SetDestinationPhotosResult>;
export type SignDestinationUploadsAction = (
  input: AdminDestinationSignPhotoUploadsInput,
) => Promise<SignPhotoUploadsResult<SignDestinationUploadsCode>>;

// ── Giá trị form ────────────────────────────────────────────────────────────

export interface DestinationPhotoDraft extends Keyed {
  publicId: string;
  /** URL delivery `f_auto,q_auto` — thumbnail dựng từ nó (`tourPhotoThumb`). */
  url: string;
  alt: string;
  source: MediaSource;
  /** Số tour đang mượn ảnh lúc trang tải — nuôi dòng nguồn và câu hậu quả khi gỡ. */
  usedByTours: number;
  author: string | null;
  license: string | null;
  /** Chỉ ảnh VỪA tải lên trong lần sửa này — metadata Cloudinary trả về. */
  upload?: TourPhotoUpload;
}

export interface DestinationPhotosValues {
  photos: DestinationPhotoDraft[];
}

export interface DestinationPhotosErrors {
  /** Lỗi của CẢ danh sách (quá trần). */
  list?: string;
  /** Lỗi ô alt, khoá theo `key` của dòng. */
  rows: Record<string, string>;
}

/** Key tất định theo vị trí (bài học 12) — form dựng hai lần, SSR rồi hydrate. */
export function destinationPhotosFormValues(
  detail: AdminDestinationPhotos,
): DestinationPhotosValues {
  return {
    photos: detail.photos.map((photo, index) => ({
      key: `photo-${index}`,
      publicId: photo.publicId,
      url: photo.url,
      alt: photo.alt ?? '',
      source: photo.source,
      usedByTours: photo.usedByTours,
      author: photo.author,
      license: photo.license,
    })),
  };
}

/**
 * Soi gương contract (một publicId một lần, alt 1 đến 300 ký tự, tối đa 30 ảnh) để không bao giờ
 * tới INVALID_INPUT. Danh sách rỗng hợp lệ — hỏi lại là việc của `needsEmptyConfirm`.
 */
export function validateDestinationPhotos(
  values: DestinationPhotosValues,
): DestinationPhotosErrors {
  const rows: Record<string, string> = {};
  const seen = new Set<string>();
  for (const photo of values.photos) {
    const alt = photo.alt.trim();
    if (seen.has(photo.publicId)) rows[photo.key] = photosCopy.duplicate;
    else if (alt === '') rows[photo.key] = photosCopy.altRequired;
    else if (alt.length > TOUR_PHOTO_ALT_MAX)
      rows[photo.key] = formErrors.tooLong(TOUR_PHOTO_ALT_MAX);
    seen.add(photo.publicId);
  }
  const extra = values.photos.length - DESTINATION_PHOTOS_MAX;
  return extra > 0
    ? { list: formErrors.tooManyPhotos(DESTINATION_PHOTOS_MAX, extra), rows }
    : { rows };
}

export function hasDestinationPhotoErrors(errors: DestinationPhotosErrors): boolean {
  return errors.list !== undefined || Object.keys(errors.rows).length > 0;
}

/** Giá trị form → input `setPhotos`. Gọi SAU khi kiểm đã sạch. */
export function destinationPhotosPayload(
  id: string,
  version: string,
  values: DestinationPhotosValues,
): AdminDestinationSetPhotosInput {
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

/** Lưu danh sách rỗng cho điểm đến đang hiện thì hỏi lại (spec §7.1): thẻ của nó mất ảnh bìa. */
export function needsEmptyConfirm(isActive: boolean, values: DestinationPhotosValues): boolean {
  return isActive && values.photos.length === 0;
}

// ── Dòng nguồn và câu hậu quả ───────────────────────────────────────────────

/** Dòng dưới ô alt: nguồn, ghi công nếu có, số tour đang mượn nếu có. */
export function destinationPhotoSourceLine(photo: DestinationPhotoDraft): string {
  return [
    t.source[photo.source],
    ...(photo.author === null ? [] : [photosCopy.credit(photo.author, photo.license)]),
    ...(photo.usedByTours > 0 ? [t.usedBy(photo.usedByTours)] : []),
  ].join(' · ');
}

export interface RemovedDestinationPhoto {
  photo: DestinationPhotoDraft;
  consequence: string;
}

/**
 * Ảnh của bản ĐÃ LƯU không còn trong bản đang soạn — mỗi ảnh một câu hậu quả (spec §7.3). Tour
 * mượn ảnh giữ dòng của mình và bộ dọn hoãn file chừng nào còn dòng ấy, nên ảnh tải lên có tour
 * mượn không bị xoá: chỉ nói câu "tour giữ ảnh". Ảnh catalog thì nói thêm rằng không thêm lại
 * được. Ảnh vừa tải rồi gỡ trước khi lưu không có ở đây: nó chưa từng vào thư viện.
 */
export function removedDestinationPhotos(
  base: DestinationPhotosValues,
  values: DestinationPhotosValues,
): RemovedDestinationPhoto[] {
  const kept = new Set(values.photos.map((photo) => photo.publicId));
  return base.photos
    .filter((photo) => !kept.has(photo.publicId))
    .map((photo) => ({ photo, consequence: removalConsequence(photo) }));
}

function removalConsequence(photo: DestinationPhotoDraft): string {
  const borrowed = photo.usedByTours > 0 ? [t.removed.usedByTours(photo.usedByTours)] : [];
  if (photo.source === 'CATALOG') return [...borrowed, t.removed.catalog].join(' ');
  return borrowed[0] ?? t.removed.upload;
}

/** Thêm lại một ảnh đã gỡ (bản đã lưu, kể cả alt) vào cuối danh sách; đã có thì giữ nguyên. */
export function putBack(
  values: DestinationPhotosValues,
  photo: DestinationPhotoDraft,
): DestinationPhotosValues {
  if (values.photos.some((item) => item.publicId === photo.publicId)) return values;
  return { photos: [...values.photos, photo] };
}

// ── Tải lên ─────────────────────────────────────────────────────────────────

/** Ảnh vừa tải → dòng mới; alt để trống, admin phải điền trước khi lưu. */
export function uploadedDestinationPhotoDraft(
  uploaded: UploadedPhoto,
  cloudName: string,
): DestinationPhotoDraft {
  return {
    key: newItemKey(),
    publicId: uploaded.publicId,
    url: cloudinaryImageUrl(cloudName, uploaded.publicId, uploaded.upload.version),
    alt: '',
    source: 'UPLOAD',
    usedByTours: 0,
    author: null,
    license: null,
    upload: uploaded.upload,
  };
}

/** Hai câu chung với tab Photos của tour; câu "đầy" nói về điểm đến. */
export function destinationSkippedCopy(file: SkippedFile): string {
  return file.reason === 'full'
    ? t.skippedFull(file.name)
    : photosCopy.skipped[file.reason](file.name);
}
