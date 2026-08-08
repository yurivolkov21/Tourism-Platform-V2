import { Injectable } from '@nestjs/common';
import type { MediaItem } from '@tourism/contract';
import { prisma } from '../../auth/auth.config.js';
import { env } from '../../config/env.js';
import type { MediaOwnerType } from '../../generated/prisma/enums.js';
import { buildCloudinaryUrl } from '../../lib/cloudinary-url.js';

@Injectable()
export class MediaService {
  /**
   * Resolve media cho NHIỀU owner trong MỘT query (chống N+1, ADR-0005). Trả
   * Map ownerId → MediaItem[] đã dựng URL. Sort chính theo sortOrder asc, sort
   * phụ theo role asc — Postgres sắp enum theo đúng thứ tự khai báo trong
   * schema.prisma (hero, gallery, avatar, body) nên hero luôn đứng trước khi
   * sortOrder bằng nhau (ví dụ nhiều asset cùng dùng default 0). Owner không
   * có asset không xuất hiện trong Map.
   */
  async resolveForOwners(
    ownerType: MediaOwnerType,
    ownerIds: string[],
  ): Promise<Map<string, MediaItem[]>> {
    const map = new Map<string, MediaItem[]>();
    if (ownerIds.length === 0) return map;

    const assets = await prisma.mediaAsset.findMany({
      where: { ownerType, ownerId: { in: ownerIds } },
      orderBy: [{ sortOrder: 'asc' }, { role: 'asc' }],
    });

    const cloudName = env.CLOUDINARY_CLOUD_NAME;
    for (const asset of assets) {
      const { url, posterUrl } = buildCloudinaryUrl(cloudName, {
        type: asset.type,
        publicId: asset.publicId,
        posterId: asset.posterId,
      });
      const item: MediaItem = {
        publicId: asset.publicId,
        url,
        type: asset.type,
        role: asset.role,
        posterUrl,
        width: asset.width,
        height: asset.height,
        alt: asset.alt,
        sortOrder: asset.sortOrder,
        // Ghi công (ADR-0020) đi CÙNG asset ra tới web, không phải tra riêng:
        // giấy phép CC đòi hiển thị ghi công ở nơi dùng ảnh, nên bốn trường này
        // phải có mặt ở mọi đường đọc, không chỉ ở màn admin.
        author: asset.author,
        license: asset.license,
        licenseUrl: asset.licenseUrl,
        sourceUrl: asset.sourceUrl,
      };
      const list = map.get(asset.ownerId);
      if (list) list.push(item);
      else map.set(asset.ownerId, [item]);
    }
    return map;
  }
}
