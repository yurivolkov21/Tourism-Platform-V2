import type { SignedUploadParams } from '@tourism/contract';
import { uploadToCloudinary as uploadImage } from '@tourism/ui/lib/cloudinary-upload';

/**
 * Đường upload trực tiếp browser → Cloudinary (ADR-0021): API chỉ ký, bytes không đi qua
 * Nest. Từ G15 (ADR-0021 AMEND 3) phần chung với admin — đuôi file, dựng form, khung XHR có
 * hạn giờ và huỷ — ở `@tourism/ui/lib/cloudinary-upload`; file này chỉ giữ phần riêng của
 * web (đọc mỗi `public_id`) và giữ nguyên tên hàm, nên component và spec đang mock
 * `@/lib/media-upload` không đổi.
 */

export { imageExtensionOf } from '@tourism/ui/lib/cloudinary-upload';

/** `public_id` ĐẦY ĐỦ từ phản hồi Cloudinary (tự ghép `<folder>/<basename>`); thiếu hay rỗng → null. */
export function publicIdOf(body: unknown): string | null {
  const publicId =
    typeof body === 'object' && body !== null && 'public_id' in body
      ? String((body as { public_id: unknown }).public_id)
      : '';
  return publicId === '' ? null : publicId;
}

/**
 * POST file lên Cloudinary, báo tiến trình 0–100. Trả `public_id` ĐẦY ĐỦ — đúng chuỗi API cần
 * nhận lại ở account.setAvatar / reviews.create.photos. Hết giờ (`UPLOAD_TIMEOUT_MS`) là
 * reject như mọi lỗi tải khác.
 */
export function uploadToCloudinary(
  file: Blob,
  params: SignedUploadParams,
  onProgress?: (pct: number) => void,
): Promise<string> {
  return uploadImage(file, params, publicIdOf, { onProgress });
}
