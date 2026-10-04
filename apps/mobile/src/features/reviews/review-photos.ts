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

/** Id theo đúng thứ tự hiển thị, hoặc `null` nếu còn ảnh đang tải/lỗi. */
export function donePhotoPublicIds(photos: readonly ReviewPhotoItem[]): string[] | null {
  const ids: string[] = [];
  for (const photo of photos) {
    if (photo.status !== 'done' || photo.publicId === null) return null;
    ids.push(photo.publicId);
  }
  return ids;
}
