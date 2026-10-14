import { ALLOWED_IMAGE_EXTENSIONS, type SignedUploadParams } from '@tourism/contract';

/**
 * Tải ảnh thẳng từ trình duyệt lên Cloudinary (ADR-0021): API chỉ ký, bytes không đi qua
 * Nest. MỘT bản cho cả web (avatar, ảnh review) và admin (ảnh tour, ảnh bìa bài viết) từ
 * G15 (ADR-0021 AMEND 3) — trước đó hai app chép tay nhau và bản web không có hạn giờ. Hai
 * app đọc phản hồi khác nhau nên khung XHR nhận hàm `parse`; phần đọc riêng ở lại app
 * (`apps/web/src/lib/media-upload.ts`, `apps/admin/src/lib/photo-upload.ts`). Mobile có bản
 * riêng vì React Native gửi file bằng `{uri, name, type}` chứ không bằng `Blob`.
 *
 * Phần thuần tách riêng để TDD; XHR vì fetch chưa có tiến độ upload.
 */

type AllowedExt = (typeof ALLOWED_IMAGE_EXTENSIONS)[number];

/** Đuôi ảnh từ tên file, chuẩn hoá lowercase; ngoài whitelist → null. */
export function imageExtensionOf(filename: string): AllowedExt | null {
  const dot = filename.lastIndexOf('.');
  if (dot <= 0) return null;
  const ext = filename.slice(dot + 1).toLowerCase();
  return (ALLOWED_IMAGE_EXTENSIONS as readonly string[]).includes(ext) ? (ext as AllowedExt) : null;
}

/**
 * Bộ field khớp TRỌN chữ ký {folder, public_id, timestamp, allowed_formats, transformation,
 * overwrite} (ADR-0021 AMEND 1, 2): thiếu hay thừa một tham số đã ký là Cloudinary 401. Bản
 * mobile của danh sách này là `buildUploadFields` — đổi tham số ký thì sửa cả hai.
 */
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
 * Hạn giờ của một lượt POST (vòng review F18): 10 MB qua đường lên chừng 0,3 Mbit/s vẫn kịp;
 * treo lâu hơn là kết nối đã chết. Mặc định của XHR là 0 — không bao giờ hết giờ — và một
 * dòng tải treo là nút quay mãi (ô avatar của web) hay khoá nút Save của cả tab (admin).
 */
export const UPLOAD_TIMEOUT_MS = 5 * 60_000;

export interface UploadOptions {
  /** Tiến độ 0–100, đã làm tròn. */
  onProgress?: (percent: number) => void;
  /** Huỷ lượt tải đang chạy, vd. khi rời tab giữa lúc tải. */
  signal?: AbortSignal;
}

/**
 * POST file lên Cloudinary, báo tiến độ 0–100, trả thứ `parse` đọc được từ phản hồi 2xx.
 * Mọi thất bại đều reject: mã lỗi, `parse` trả null, body không phải JSON, lỗi mạng, hết giờ
 * và bị huỷ qua `signal`.
 */
export function uploadToCloudinary<T>(
  file: Blob,
  params: SignedUploadParams,
  parse: (body: unknown) => T | null,
  { onProgress, signal }: UploadOptions = {},
): Promise<T> {
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
      // try/catch bắt buộc: ném trong callback của executor KHÔNG reject promise — body 2xx
      // không phải JSON mà không bắt là caller await treo mãi.
      try {
        const parsed =
          xhr.status >= 200 && xhr.status < 300 ? parse(JSON.parse(xhr.responseText)) : null;
        if (parsed !== null) resolve(parsed);
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
