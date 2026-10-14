import type { ALLOWED_IMAGE_EXTENSIONS } from '@tourism/contract';
import { REVIEW_PHOTO_MAX_BYTES, REVIEW_PHOTOS_MAX } from '@tourism/contract';
import { imageExtensionOfMime } from '@/features/account/avatar-flow';

type AllowedExt = (typeof ALLOWED_IMAGE_EXTENSIONS)[number];

/**
 * Một ô ảnh trong form review (R2). `publicId` chỉ có khi `status === 'done'`:
 * ảnh đã tải thẳng lên Cloudinary, server giữ id để gắn vào review lúc gửi.
 */
export interface ReviewPhotoItem {
  key: string;
  uri: string;
  ext: AllowedExt;
  status: 'uploading' | 'done' | 'error';
  publicId: string | null;
}

export type ReviewPhotoError = 'notImage' | 'tooLarge' | 'tooMany';

/** Kiểm một ảnh vừa chọn: đủ chỗ → đúng định dạng → đúng dung lượng (ADR-0021 §2). */
export function validateReviewPhoto(
  asset: { mimeType?: string | null; fileSize?: number | null },
  currentCount: number,
): ReviewPhotoError | null {
  if (currentCount >= REVIEW_PHOTOS_MAX) return 'tooMany';
  if (imageExtensionOfMime(asset.mimeType) === null) return 'notImage';
  if (typeof asset.fileSize === 'number' && asset.fileSize > REVIEW_PHOTO_MAX_BYTES) {
    return 'tooLarge';
  }
  return null;
}

/** Phần copy mà câu lỗi ảnh cần (`messages.reviews.photos`). */
export interface ReviewPhotoErrorCopy {
  errNotImage: string;
  errTooLarge: (size: string) => string;
  errTooMany: (max: number) => string;
}

/**
 * Câu lỗi của MỘT ảnh vừa chọn. Số trong câu đọc đúng trần mà `validateReviewPhoto` chặn
 * (`REVIEW_PHOTO_MAX_BYTES`, `REVIEW_PHOTOS_MAX` của contract) — bản ghi cứng "10 MB" và 5 cũ
 * sẽ nói sai ngay khi contract đổi trần (nợ nhỏ P5b-5 mục 3).
 */
export function reviewPhotoErrorText(error: ReviewPhotoError, copy: ReviewPhotoErrorCopy): string {
  if (error === 'notImage') return copy.errNotImage;
  if (error === 'tooLarge') return copy.errTooLarge(formatMegabytes(REVIEW_PHOTO_MAX_BYTES));
  return copy.errTooMany(REVIEW_PHOTOS_MAX);
}

/** "10 MB", "1.5 MB" — cùng cách viết với `formatBytes` của web cho một trần tính bằng MB. */
export function formatMegabytes(bytes: number): string {
  return `${Number.parseFloat((bytes / 1024 ** 2).toFixed(1))} MB`;
}

/** Id theo đúng thứ tự hiển thị, hoặc `null` nếu còn ảnh đang tải/lỗi. */
export function donePhotoPublicIds(photos: readonly ReviewPhotoItem[]): string[] | null {
  const ids: string[] = [];
  for (const photo of photos) {
    if (photo.status !== 'done' || photo.publicId === null) return null;
    ids.push(photo.publicId);
  }
  return ids;
}
