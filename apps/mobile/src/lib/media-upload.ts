import type { SignedUploadParams } from '@tourism/contract';

/**
 * Đường upload trực tiếp mobile → Cloudinary (ADR-0021, port từ
 * `apps/web/src/lib/media-upload.ts`): API chỉ ký, bytes không đi qua Nest.
 *
 * Khác web: dùng `XMLHttpRequest`, KHÔNG `fetch`. `globalThis.fetch` của app
 * này là "winter" fetch chuẩn WHATWG (Expo SDK 57 polyfill, cùng lý do
 * `AbortSignal.any` chạy được — `lib/api/client.ts`), và đã THỬ hai cách qua
 * fetch, cả hai đều vỡ (phản hồi 27/09):
 * 1. `FormData.append('file', {uri,name,type})` — winter fetch ném
 *    `Unsupported FormDataPart implementation`: fetch chuẩn spec chỉ hiểu
 *    `Blob`/`File` thật trong FormData, không hiểu object `{uri,name,type}`
 *    (mẹo riêng của XHR/fetch legacy RN).
 * 2. `fetch(uri).blob()` rồi append Blob thật — ĐỌC SAI file cục bộ: blob ra
 *    14 byte rỗng, MIME trống, Cloudinary từ chối "Raw file format not
 *    allowed" (coi là raw vì không nhận ra ảnh).
 *
 * `XMLHttpRequest` là API riêng của RN (module `RCTNetworking`), KHÔNG bị
 * winter runtime thay — `send()` đọc file cục bộ từ `{uri,name,type}` TRỰC
 * TIẾP từ đĩa, không qua Blob/fetch nào cả. Đây là cách chuẩn RN cho upload
 * ảnh, không phải lối tắt.
 */

/** Bộ field Cloudinary xác thực, KHÔNG kèm `file` — khớp TRỌN chữ ký
 * {folder, public_id, timestamp, allowed_formats, transformation, overwrite}
 * (cùng luật web: thiếu/thừa một tham số đã ký là Cloudinary 401). */
export function buildUploadFields(params: SignedUploadParams): Record<string, string> {
  return {
    api_key: params.apiKey,
    timestamp: String(params.timestamp),
    signature: params.signature,
    folder: params.folder,
    public_id: params.publicId,
    allowed_formats: params.allowedFormats,
    transformation: params.transformation,
    overwrite: String(params.overwrite),
  };
}

function buildUploadFormData(uri: string, ext: string, params: SignedUploadParams): FormData {
  const form = new FormData();
  form.append('file', { uri, name: `avatar.${ext}`, type: `image/${ext}` } as unknown as Blob);
  for (const [key, value] of Object.entries(buildUploadFields(params))) form.append(key, value);
  return form;
}

/**
 * POST file lên Cloudinary, trả `public_id` ĐẦY ĐỦ (Cloudinary tự ghép
 * `<folder>/<basename>`) — đúng chuỗi `account.setAvatar` cần nhận lại.
 * KHÔNG test I/O thật (cùng ranh giới web: `uploadToCloudinary` không có spec).
 */
export function uploadToCloudinary(
  uri: string,
  ext: string,
  params: SignedUploadParams,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', params.uploadUrl);
    xhr.addEventListener('load', () => {
      // try/catch bắt buộc: throw trong callback async của executor KHÔNG
      // reject promise — JSON.parse ném (2xx nhưng body không phải JSON) mà
      // không bắt là caller await treo vĩnh viễn (cùng finding review web).
      try {
        if (xhr.status >= 200 && xhr.status < 300) {
          const body: unknown = JSON.parse(xhr.responseText);
          const publicId =
            typeof body === 'object' && body !== null && 'public_id' in body
              ? String((body as { public_id: unknown }).public_id)
              : '';
          if (publicId) {
            resolve(publicId);
            return;
          }
        }
        reject(new Error(`Cloudinary upload failed (${xhr.status})`));
      } catch {
        reject(new Error('Cloudinary upload failed (invalid response)'));
      }
    });
    xhr.addEventListener('error', () => reject(new Error('Cloudinary upload failed (network)')));
    xhr.send(buildUploadFormData(uri, ext, params));
  });
}
