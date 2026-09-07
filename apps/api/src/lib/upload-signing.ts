import type { SignedUploadParams } from '@tourism/contract';
import { v2 as cloudinary } from 'cloudinary';

/**
 * Lõi THUẦN của bề mặt ghi media (ADR-0021) — mọi thứ tính được không cần
 * DB/env sống ở đây để TDD với secret giả. Service chỉ còn orchestration
 * (soi quyền booking + sinh publicId/timestamp).
 */

export interface UploadSigningConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  rootFolder: string;
}

/**
 * Cặp key/secret là optional theo env schema (môi trường chỉ-đọc như CI
 * không mang secret vẫn boot) — thiếu một nửa cặp coi như CHƯA cấu hình,
 * trả null để service ném MEDIA_UPLOAD_NOT_CONFIGURED.
 */
export function resolveUploadConfig(env: {
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
  CLOUDINARY_UPLOAD_FOLDER: string;
}): UploadSigningConfig | null {
  if (!env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) return null;
  return {
    cloudName: env.CLOUDINARY_CLOUD_NAME,
    apiKey: env.CLOUDINARY_API_KEY,
    apiSecret: env.CLOUDINARY_API_SECRET,
    rootFolder: env.CLOUDINARY_UPLOAD_FOLDER,
  };
}

/** Folder do SERVER quyết theo purpose (ADR-0021 §1) — client không được chọn chỗ đặt file. */
export function uploadFolderFor(
  rootFolder: string,
  req: { purpose: 'AVATAR'; userId: string } | { purpose: 'REVIEW_PHOTO'; bookingCode: string },
): string {
  return req.purpose === 'AVATAR'
    ? `${rootFolder}/avatars/${req.userId}`
    : `${rootFolder}/reviews/${req.bookingCode}`;
}

/**
 * Format Cloudinary được phép LƯU (W4 U1, ADR-0021 AMEND 1) — chuỗi phẩy
 * đúng dạng tham số `allowed_formats`. Chữ ký không phủ endpoint
 * `/<resource_type>/upload`, nên whitelist ĐUÔI ở contract chỉ chặn client
 * ngoan; tham số này nằm TRONG chữ ký thì Cloudinary tự từ chối video/raw
 * kể cả khi POST sang endpoint khác. KHÔNG 1:1 với whitelist đuôi
 * (avif/gif client vẫn gửi được — Cloudinary nhận diện nội dung rồi từ
 * chối; heic/heif cho ảnh iPhone, Cloudinary chuyển mã được).
 */
export const ALLOWED_UPLOAD_FORMATS = 'jpg,jpeg,png,webp,heic,heif';

/**
 * Incoming transformation (W4 U1): bản LƯU là bản đã transform — EXIF/GPS
 * bị strip theo thiết kế (transform sinh ảnh mới, không chép metadata), khổ
 * trần 2400px chặn ảnh trăm-megapixel. `c_limit` không cắt cúp (giữ luật
 * cấm crop của ADR-0020) và không phóng to ảnh nhỏ hơn.
 */
export const INCOMING_TRANSFORMATION = 'c_limit,w_2400,h_2400';

/**
 * Ký bộ `{folder, public_id, timestamp, allowed_formats, transformation}`
 * bằng api_sign_request của SDK — đúng thuật toán Cloudinary xác thực phía
 * họ; api_secret chỉ đi vào hàm này, không bao giờ nằm trong giá trị trả
 * về. MỌI ràng buộc phải là THAM SỐ ĐƯỢC KÝ (ADR-0021 AMEND 1) — client
 * thiếu/sửa một cái là Cloudinary 401. Cụm này chỉ ký ẢNH nên uploadUrl cố
 * định resource `image`.
 */
export function buildSignedUploadParams(
  cfg: UploadSigningConfig,
  folder: string,
  publicId: string,
  timestamp: number,
): SignedUploadParams {
  const signature = cloudinary.utils.api_sign_request(
    {
      folder,
      public_id: publicId,
      timestamp,
      allowed_formats: ALLOWED_UPLOAD_FORMATS,
      transformation: INCOMING_TRANSFORMATION,
    },
    cfg.apiSecret,
  );
  return {
    signature,
    timestamp,
    apiKey: cfg.apiKey,
    cloudName: cfg.cloudName,
    folder,
    publicId,
    allowedFormats: ALLOWED_UPLOAD_FORMATS,
    transformation: INCOMING_TRANSFORMATION,
    uploadUrl: `https://api.cloudinary.com/v1_1/${cfg.cloudName}/image/upload`,
  };
}

/**
 * publicId Cloudinary trả về có dạng `<folder>/<basename>` — avatar hợp lệ
 * của CHÍNH user phải nằm trọn trong segment `<root>/avatars/<userId>/`.
 * So theo segment (kèm dấu `/` chốt đuôi) để 'u-1-evil' không giả được 'u-1'.
 */
export function isOwnAvatarPublicId(rootFolder: string, userId: string, publicId: string): boolean {
  return publicId.startsWith(`${rootFolder}/avatars/${userId}/`);
}
