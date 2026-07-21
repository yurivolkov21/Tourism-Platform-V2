import { MediaType } from '../generated/prisma/enums.js';

const BASE = 'https://res.cloudinary.com';

/**
 * publicId đã là URL tuyệt đối (seed/placeholder Unsplash) → dùng nguyên.
 */
function isAbsoluteUrl(publicId: string): boolean {
  return /^https?:\/\//.test(publicId);
}

/**
 * Dựng URL delivery Cloudinary từ `publicId` (ADR-0005). Thuần, không DB.
 * Ảnh: transform `f_auto,q_auto`. Video: URL video + poster riêng (posterId
 * nếu có, không thì frame đầu `so_0` của chính video). publicId tuyệt đối trả
 * nguyên (escape-hatch cho fixture).
 */
export function buildCloudinaryUrl(
  cloudName: string,
  asset: { type: MediaType; publicId: string; posterId?: string | null },
): { url: string; posterUrl: string | null } {
  if (isAbsoluteUrl(asset.publicId)) {
    return { url: asset.publicId, posterUrl: null };
  }
  const resource = asset.type === MediaType.VIDEO ? 'video' : 'image';
  const url = `${BASE}/${cloudName}/${resource}/upload/f_auto,q_auto/${asset.publicId}`;
  if (asset.type !== MediaType.VIDEO) {
    return { url, posterUrl: null };
  }
  const posterUrl =
    asset.posterId && !isAbsoluteUrl(asset.posterId)
      ? `${BASE}/${cloudName}/image/upload/f_auto,q_auto/${asset.posterId}`
      : asset.posterId && isAbsoluteUrl(asset.posterId)
        ? asset.posterId
        : `${BASE}/${cloudName}/video/upload/so_0,f_auto,q_auto/${asset.publicId}.jpg`;
  return { url, posterUrl };
}
