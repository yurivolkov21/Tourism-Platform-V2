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
 * Ký bộ `{folder, public_id, timestamp}` bằng api_sign_request của SDK —
 * đúng thuật toán Cloudinary xác thực phía họ; api_secret chỉ đi vào hàm
 * này, không bao giờ nằm trong giá trị trả về. Cụm này chỉ ký ẢNH nên
 * uploadUrl cố định resource `image` (video là chuyện P4).
 */
export function buildSignedUploadParams(
  cfg: UploadSigningConfig,
  folder: string,
  publicId: string,
  timestamp: number,
): SignedUploadParams {
  const signature = cloudinary.utils.api_sign_request(
    { folder, public_id: publicId, timestamp },
    cfg.apiSecret,
  );
  return {
    signature,
    timestamp,
    apiKey: cfg.apiKey,
    cloudName: cfg.cloudName,
    folder,
    publicId,
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
