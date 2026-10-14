import type { SignedUploadParams, TourPhotoUpload } from '@tourism/contract';
import { uploadToCloudinary } from '@tourism/ui/lib/cloudinary-upload';

/**
 * Đường tải ảnh tour browser → Cloudinary (ADR-0048 §4, khuôn ADR-0021): API chỉ ký, bytes
 * không đi qua Nest. Từ G15 (ADR-0021 AMEND 3) phần chung với web — đuôi file, dựng form,
 * khung XHR có hạn giờ và huỷ — ở `@tourism/ui/lib/cloudinary-upload`; file này giữ phần
 * riêng của admin: tab Photos cần thêm metadata để API ghi dòng ảnh không phải hỏi lại
 * Cloudinary (ADR-0048 §5), còn web chỉ cần `public_id`. Tên hàm giữ nguyên nên component và
 * spec đang mock `@/lib/photo-upload` không đổi.
 */

export { imageExtensionOf } from '@tourism/ui/lib/cloudinary-upload';

export interface UploadedPhoto {
  /** publicId ĐẦY ĐỦ `<folder>/<basename>` — đúng chuỗi API nhận lại ở `setPhotos` (tour) và `update` (ảnh bìa bài viết). */
  publicId: string;
  upload: TourPhotoUpload;
}

/**
 * Phản hồi thành công của Cloudinary → ảnh đã tải; thiếu hay sai kiểu một field →
 * null. Kiểm từng field bằng một `if` riêng để TypeScript thu hẹp kiểu chắc chắn.
 */
export function parseUploadResponse(body: unknown): UploadedPhoto | null {
  if (typeof body !== 'object' || body === null) return null;
  const record = body as Record<string, unknown>;
  const publicId = record.public_id;
  const version = record.version;
  const width = record.width;
  const height = record.height;
  const format = record.format;
  const bytes = record.bytes;
  if (typeof publicId !== 'string' || publicId === '') return null;
  if (typeof version !== 'number' && typeof version !== 'string') return null;
  if (typeof width !== 'number' || !Number.isInteger(width)) return null;
  if (typeof height !== 'number' || !Number.isInteger(height)) return null;
  if (typeof format !== 'string' || format === '') return null;
  if (typeof bytes !== 'number' || !Number.isInteger(bytes)) return null;
  return { publicId, upload: { version: String(version), width, height, format, bytes } };
}

/**
 * POST file lên Cloudinary, báo tiến độ 0–100, trả publicId kèm số đo ảnh. Mọi thất bại đều
 * reject — kể cả hết giờ (`UPLOAD_TIMEOUT_MS` của bản dùng chung) và bị huỷ qua `signal` (tab
 * bị rời giữa lúc tải).
 *
 * Dùng chung cho ảnh tour (F18) và ảnh bìa bài viết (P4e-4) — không phụ thuộc tour.
 */
export function uploadPhoto(
  file: Blob,
  params: SignedUploadParams,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<UploadedPhoto> {
  return uploadToCloudinary(file, params, parseUploadResponse, { onProgress, signal });
}
