import { ALLOWED_IMAGE_EXTENSIONS, type SignedUploadParams } from '@tourism/contract';

/**
 * Đường upload trực tiếp browser → Cloudinary (ADR-0021): API chỉ ký, bytes
 * không đi qua Nest. Phần thuần (đuôi file, dựng form) tách riêng để TDD;
 * riêng uploadToCloudinary dùng XHR vì fetch chưa có tiến trình upload.
 */

type AllowedExt = (typeof ALLOWED_IMAGE_EXTENSIONS)[number];

/** Đuôi ảnh từ tên file, chuẩn hoá lowercase; ngoài whitelist → null. */
export function imageExtensionOf(filename: string): AllowedExt | null {
  const dot = filename.lastIndexOf('.');
  if (dot <= 0) return null;
  const ext = filename.slice(dot + 1).toLowerCase();
  return (ALLOWED_IMAGE_EXTENSIONS as readonly string[]).includes(ext) ? (ext as AllowedExt) : null;
}

/** Bộ field Cloudinary xác thực — khớp chữ ký {folder, public_id, timestamp}. */
export function buildUploadFormData(file: Blob, params: SignedUploadParams): FormData {
  const form = new FormData();
  form.set('file', file);
  form.set('api_key', params.apiKey);
  form.set('timestamp', String(params.timestamp));
  form.set('signature', params.signature);
  form.set('folder', params.folder);
  form.set('public_id', params.publicId);
  return form;
}

/**
 * POST file lên Cloudinary, báo tiến trình 0–100. Trả `public_id` ĐẦY ĐỦ
 * (Cloudinary tự ghép `<folder>/<basename>`) — đúng chuỗi API cần nhận lại
 * ở account.setAvatar / reviews.create.photos.
 */
export function uploadToCloudinary(
  file: Blob,
  params: SignedUploadParams,
  onProgress?: (pct: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', params.uploadUrl);
    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
    });
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const body: unknown = JSON.parse(xhr.responseText);
        const publicId =
          typeof body === 'object' && body !== null && 'public_id' in body
            ? String((body as { public_id: unknown }).public_id)
            : '';
        if (publicId) return resolve(publicId);
      }
      reject(new Error(`Cloudinary upload failed (${xhr.status})`));
    });
    xhr.addEventListener('error', () => reject(new Error('Cloudinary upload failed (network)')));
    xhr.send(buildUploadFormData(file, params));
  });
}
