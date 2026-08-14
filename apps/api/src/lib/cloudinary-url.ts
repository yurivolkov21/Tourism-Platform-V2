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
 *
 * ── `version`: vì sao URL phải mang nó ──
 * Thay ảnh mà giữ nguyên `publicId` thì URL không đổi một ký tự, nên **bốn**
 * tầng cache đều tiếp tục phát bản cũ: CDN Cloudinary (invalidate lan chậm và
 * KHÔNG cùng lúc cho biến thể JPEG/WebP của `f_auto`), `.next/cache/images`,
 * thư mục build, và nặng nhất là **cache trình duyệt người dùng** — response
 * `/_next/image` mang `max-age=2592000`, tức **30 ngày**. Ba tầng đầu còn xoá
 * tay được; tầng thứ tư thì không, nó nằm trên máy người khác.
 *
 * Chèn `/v<version>/` làm mỗi lần thay ảnh sinh một URL KHÁC, nên cả bốn tầng
 * tự hết hiệu lực. Đây là cách Cloudinary thiết kế để giải đúng việc này.
 *
 * `version` nullable: ảnh ghi trước khi có cột này vẫn dựng URL như cũ.
 */
export function buildCloudinaryUrl(
  cloudName: string,
  asset: {
    type: MediaType;
    publicId: string;
    posterId?: string | null;
    version?: string | null;
  },
): { url: string; posterUrl: string | null } {
  if (isAbsoluteUrl(asset.publicId)) {
    return { url: asset.publicId, posterUrl: null };
  }
  const resource = asset.type === MediaType.VIDEO ? 'video' : 'image';
  // Đoạn phiên bản nằm SAU transform và TRƯỚC publicId — đúng thứ tự Cloudinary
  // quy định; đảo lại là 404.
  const v = asset.version ? `v${asset.version}/` : '';
  const url = `${BASE}/${cloudName}/${resource}/upload/f_auto,q_auto/${v}${asset.publicId}`;
  if (asset.type !== MediaType.VIDEO) {
    return { url, posterUrl: null };
  }
  const posterUrl =
    asset.posterId && !isAbsoluteUrl(asset.posterId)
      ? // posterId là asset RIÊNG, có phiên bản riêng — không mượn version của video
        `${BASE}/${cloudName}/image/upload/f_auto,q_auto/${asset.posterId}`
      : asset.posterId && isAbsoluteUrl(asset.posterId)
        ? asset.posterId
        : // poster suy từ chính video nên dùng CHUNG version với nó
          `${BASE}/${cloudName}/video/upload/so_0,f_auto,q_auto/${v}${asset.publicId}.jpg`;
  return { url, posterUrl };
}
