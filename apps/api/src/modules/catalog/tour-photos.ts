import type { AdminLibraryPhoto, AdminTourPhoto, MediaItem } from '@tourism/contract';
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

/** Một asset đã dựng URL → ảnh như tab Photos cần; nguồn suy từ thư mục. */
export function toAdminTourPhoto(
  item: MediaItem,
  rootFolder: string,
  tourId: string,
): AdminTourPhoto {
  return {
    publicId: item.publicId,
    url: item.url,
    alt: item.alt,
    width: item.width,
    height: item.height,
    source: isTourUploadPublicId(rootFolder, tourId, item.publicId) ? 'UPLOAD' : 'LIBRARY',
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
