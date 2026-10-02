import {
  ALLOWED_IMAGE_EXTENSIONS,
  type SignedUploadParams,
  type TourPhotoUpload,
} from '@tourism/contract';

/**
 * Đường tải ảnh tour browser → Cloudinary (ADR-0048 §4, khuôn ADR-0021): API chỉ
 * ký, bytes không đi qua Nest. Bản web (`apps/web/src/lib/media-upload.ts`) chỉ trả
 * `public_id`; tab Photos cần thêm metadata để API ghi dòng ảnh không phải hỏi lại
 * Cloudinary (ADR-0048 §5). Phần thuần tách riêng để TDD; XHR vì fetch chưa có
 * tiến độ upload.
 */
type AllowedExt = (typeof ALLOWED_IMAGE_EXTENSIONS)[number];

export interface UploadedPhoto {
  /** publicId ĐẦY ĐỦ `<folder>/<basename>` — đúng chuỗi API nhận lại ở `setPhotos` (tour) và `update` (ảnh bìa bài viết). */
  publicId: string;
  upload: TourPhotoUpload;
}

/** Đuôi ảnh từ tên file, chuẩn hoá lowercase; ngoài whitelist → null. */
export function imageExtensionOf(filename: string): AllowedExt | null {
  const dot = filename.lastIndexOf('.');
  if (dot <= 0) return null;
  const ext = filename.slice(dot + 1).toLowerCase();
  return (ALLOWED_IMAGE_EXTENSIONS as readonly string[]).includes(ext) ? (ext as AllowedExt) : null;
}

/** Bộ field khớp TRỌN chữ ký — thiếu hay thừa một tham số đã ký là Cloudinary 401. */
export function buildUploadFormData(file: Blob, params: SignedUploadParams): FormData {
  const form = new FormData();
  form.set('file', file);
  form.set('api_key', params.apiKey);
  form.set('timestamp', String(params.timestamp));
  form.set('signature', params.signature);
  form.set('folder', params.folder);
  form.set('public_id', params.publicId);
  form.set('allowed_formats', params.allowedFormats);
  form.set('transformation', params.transformation);
  form.set('overwrite', String(params.overwrite));
  return form;
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
 * Hạn giờ của một lượt POST (vòng review F18): 10 MB qua đường lên chừng 0,3 Mbit/s
 * vẫn kịp; treo lâu hơn là kết nối đã chết. Mặc định của XHR là 0 — không bao giờ hết
 * giờ — và một dòng tải treo khoá nút Save của cả tab.
 */
export const UPLOAD_TIMEOUT_MS = 5 * 60_000;

/**
 * POST file lên Cloudinary, báo tiến độ 0–100. Mọi thất bại đều reject — kể cả hết
 * giờ và bị huỷ qua `signal` (tab bị rời giữa lúc tải).
 *
 * Dùng chung cho ảnh tour (F18) và ảnh bìa bài viết (P4e-4) — không phụ thuộc tour.
 */
export function uploadPhoto(
  file: Blob,
  params: SignedUploadParams,
  onProgress?: (percent: number) => void,
  signal?: AbortSignal,
): Promise<UploadedPhoto> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Cloudinary upload aborted'));
      return;
    }
    const xhr = new XMLHttpRequest();
    xhr.open('POST', params.uploadUrl);
    xhr.timeout = UPLOAD_TIMEOUT_MS;
    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    });
    xhr.addEventListener('load', () => {
      // try/catch bắt buộc: ném trong callback của executor KHÔNG reject promise —
      // body 2xx không phải JSON mà không bắt là caller await treo mãi.
      try {
        const uploaded =
          xhr.status >= 200 && xhr.status < 300
            ? parseUploadResponse(JSON.parse(xhr.responseText))
            : null;
        if (uploaded) resolve(uploaded);
        else reject(new Error(`Cloudinary upload failed (${xhr.status})`));
      } catch {
        reject(new Error('Cloudinary upload failed (invalid response)'));
      }
    });
    xhr.addEventListener('error', () => reject(new Error('Cloudinary upload failed (network)')));
    xhr.addEventListener('timeout', () => reject(new Error('Cloudinary upload failed (timeout)')));
    xhr.addEventListener('abort', () => reject(new Error('Cloudinary upload aborted')));
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(buildUploadFormData(file, params));
  });
}
