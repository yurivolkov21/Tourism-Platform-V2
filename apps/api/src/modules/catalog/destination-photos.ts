import type { AdminDestinationPhoto, AdminTourPhotoInput, MediaItem } from '@tourism/contract';
import { isDestinationUploadPublicId } from '../../lib/upload-signing.js';
import {
  type PlannedPhotoRow,
  type StoredPhoto,
  storedUpload,
  type TourPhotoPlan,
} from './tour-photos.js';

/**
 * Logic THUẦN của trang Photos của điểm đến (ADR-0060 §8) — cùng khuôn ảnh tour (ADR-0048), trừ
 * nguồn thứ ba: điểm đến không mượn ảnh của ai, thư viện chính là nó.
 */

/**
 * Một asset đã dựng URL → ảnh như trang Photos cần. `UPLOAD` là thư mục tải lên của CHÍNH điểm đến;
 * mọi ảnh khác là `CATALOG` (ảnh đi theo site, gỡ ra thì không thêm lại được từ admin).
 * `usedByTours` đếm tour đang có dòng cùng publicId — tour mượn ảnh giữ dòng của mình khi ảnh rời
 * thư viện.
 */
export function toAdminDestinationPhoto(
  item: MediaItem,
  rootFolder: string,
  destinationId: string,
  usedByTours: ReadonlyMap<string, number>,
): AdminDestinationPhoto {
  return {
    publicId: item.publicId,
    url: item.url,
    alt: item.alt,
    width: item.width,
    height: item.height,
    source: isDestinationUploadPublicId(rootFolder, destinationId, item.publicId)
      ? 'UPLOAD'
      : 'CATALOG',
    usedByTours: usedByTours.get(item.publicId) ?? 0,
    author: item.author,
    license: item.license,
  };
}

/**
 * Danh sách ảnh gửi lên → các dòng sẽ ghi và các ảnh phải vào lại hàng dọn.
 *
 * Mỗi ảnh thuộc đúng MỘT trong hai nguồn, xét theo thứ tự: dòng ĐÃ CÓ của điểm đến (giữ metadata
 * và ghi công, đổi alt và thứ tự) → ảnh TẢI LÊN trong thư mục của điểm đến, có metadata. Không thuộc
 * nguồn nào là từ chối cả lệnh.
 *
 * Chỉ ảnh tải lên của chính điểm đến bị gỡ mới vào lại hàng dọn (`requeue`, ADR-0035 AMEND 2). Tour
 * đã mượn ảnh vẫn giữ dòng của mình, và bộ dọn hoãn file chừng nào còn dòng ấy.
 */
export function planDestinationPhotos(args: {
  destinationId: string;
  rootFolder: string;
  photos: readonly AdminTourPhotoInput[];
  /** Dòng ảnh hiện có của điểm đến, theo publicId. */
  current: ReadonlyMap<string, StoredPhoto>;
}): TourPhotoPlan {
  const isOwnUpload = (publicId: string) =>
    isDestinationUploadPublicId(args.rootFolder, args.destinationId, publicId);
  const rows: PlannedPhotoRow[] = [];
  for (const [index, photo] of args.photos.entries()) {
    const source =
      args.current.get(photo.publicId) ??
      (isOwnUpload(photo.publicId) ? storedUpload(photo) : undefined);
    if (source === undefined) return { ok: false, rejected: photo.publicId };
    rows.push({
      ...source,
      alt: photo.alt,
      role: index === 0 ? 'hero' : 'gallery',
      sortOrder: index,
    });
  }
  const kept = new Set(args.photos.map((photo) => photo.publicId));
  const requeue = [...args.current.keys()].filter(
    (publicId) => !kept.has(publicId) && isOwnUpload(publicId),
  );
  return { ok: true, rows, requeue };
}
