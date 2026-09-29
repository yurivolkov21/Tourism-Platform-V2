import type {
  AdminLibraryPhoto,
  AdminTourPhoto,
  AdminTourPhotoInput,
  MediaItem,
} from '@tourism/contract';
import { isTourUploadPublicId } from '../../lib/upload-signing.js';

/**
 * Logic THUẦN của ảnh tour (ADR-0048) — thứ tự hiển thị và hình dạng admin.
 */

/**
 * Ảnh bìa (`hero`) đầu, rồi gallery theo `sortOrder` — đúng luật `tourGallery` của
 * web, để thứ tự admin thấy là thứ tự khách thấy. Không tin `sortOrder` của ảnh bìa:
 * dữ liệu seed không bảo đảm nó là 0.
 */
export function orderTourPhotos<T extends { role: string; sortOrder: number }>(
  items: readonly T[],
): T[] {
  const hero = items.filter((item) => item.role === 'hero');
  const rest = items
    .filter((item) => item.role !== 'hero')
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return [...hero, ...rest];
}

/**
 * Một asset đã dựng URL → ảnh như tab Photos cần. Nguồn (ADR-0048 AMEND 1): thư mục tải
 * lên của tour là `UPLOAD`; publicId có trong `libraryIds` (đang có dòng `DESTINATION`)
 * là `LIBRARY`; còn lại — ảnh bìa gốc — là `CATALOG`.
 */
export function toAdminTourPhoto(
  item: MediaItem,
  rootFolder: string,
  tourId: string,
  libraryIds: ReadonlySet<string>,
): AdminTourPhoto {
  return {
    publicId: item.publicId,
    url: item.url,
    alt: item.alt,
    width: item.width,
    height: item.height,
    source: isTourUploadPublicId(rootFolder, tourId, item.publicId)
      ? 'UPLOAD'
      : libraryIds.has(item.publicId)
        ? 'LIBRARY'
        : 'CATALOG',
    author: item.author,
    license: item.license,
  };
}

/** Một asset của kho địa danh → ảnh của hộp Add from library. */
export function toLibraryPhoto(item: MediaItem): AdminLibraryPhoto {
  return {
    publicId: item.publicId,
    url: item.url,
    alt: item.alt,
    width: item.width,
    height: item.height,
    author: item.author,
    license: item.license,
  };
}

/**
 * Các cột của một dòng `media_assets` mà ảnh tour chép khi GIỮ dòng cũ hay MƯỢN
 * dòng thư viện (ADR-0048 §3). Đủ bốn cột ghi công: thiếu một cột là phát hành ảnh
 * CC BY mà không thoả điều kiện giấy phép (ADR-0020 §3).
 */
export interface StoredPhoto {
  publicId: string;
  type: 'IMAGE' | 'VIDEO';
  posterId: string | null;
  format: string | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  bytes: number | null;
  version: string | null;
  author: string | null;
  license: string | null;
  licenseUrl: string | null;
  sourceUrl: string | null;
}

/** Một dòng sẽ ghi — `role` và `sortOrder` theo vị trí, `alt` theo form. */
export interface PlannedPhotoRow extends StoredPhoto {
  alt: string;
  role: 'hero' | 'gallery';
  sortOrder: number;
}

export type TourPhotoPlan =
  | { ok: true; rows: PlannedPhotoRow[]; requeue: string[] }
  | { ok: false; rejected: string };

/**
 * Danh sách ảnh gửi lên → các dòng sẽ ghi và các ảnh phải vào lại hàng dọn.
 *
 * Mỗi ảnh thuộc đúng MỘT nguồn, xét theo thứ tự: dòng ĐÃ CÓ của tour (giữ) →
 * ảnh TẢI LÊN trong thư mục của tour, có metadata (mới) → dòng THƯ VIỆN (mượn).
 * Không thuộc nguồn nào là từ chối cả lệnh.
 *
 * Chỉ ảnh tải lên bị gỡ mới vào lại hàng dọn (ADR-0048 §6): ảnh thư viện đã kiểm
 * chứng giấy phép và ghi công, bộ dọn không phân biệt được "chỉ còn tour này dùng"
 * với "rác".
 */
export function planTourPhotos(args: {
  tourId: string;
  rootFolder: string;
  photos: readonly AdminTourPhotoInput[];
  /** Dòng ảnh hiện có của tour, theo publicId. */
  current: ReadonlyMap<string, StoredPhoto>;
  /** Dòng `DESTINATION` của những publicId gửi lên, theo publicId. */
  library: ReadonlyMap<string, StoredPhoto>;
}): TourPhotoPlan {
  const rows: PlannedPhotoRow[] = [];
  for (const [index, photo] of args.photos.entries()) {
    const source =
      args.current.get(photo.publicId) ??
      uploadedPhoto(args, photo) ??
      args.library.get(photo.publicId);
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
    (publicId) =>
      !kept.has(publicId) && isTourUploadPublicId(args.rootFolder, args.tourId, publicId),
  );
  return { ok: true, rows, requeue };
}

/** Ảnh tải lên MỚI: đúng thư mục của tour VÀ có metadata Cloudinary — thiếu một là không nhận. */
function uploadedPhoto(
  args: { tourId: string; rootFolder: string },
  photo: AdminTourPhotoInput,
): StoredPhoto | undefined {
  if (photo.upload === undefined) return undefined;
  if (!isTourUploadPublicId(args.rootFolder, args.tourId, photo.publicId)) return undefined;
  return {
    publicId: photo.publicId,
    type: 'IMAGE',
    posterId: null,
    format: photo.upload.format,
    width: photo.upload.width,
    height: photo.upload.height,
    durationSec: null,
    bytes: photo.upload.bytes,
    version: photo.upload.version,
    author: null,
    license: null,
    licenseUrl: null,
    sourceUrl: null,
  };
}
