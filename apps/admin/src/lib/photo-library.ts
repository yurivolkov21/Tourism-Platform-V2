import type { AdminPhotoLibrary } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import type { TransportFailureCode } from './api/write-error';

/**
 * Lệnh tải kho ảnh địa danh cho hộp chọn ảnh dùng chung (kit `PhotoLibraryDialog`) — ảnh
 * tour (F18) và ảnh bìa bài viết (P4e-4). Tách khỏi `tour-photos.ts` ở P4e-4.
 */
export type PhotoLibraryResult =
  | { ok: true; library: AdminPhotoLibrary }
  | { ok: false; code: TransportFailureCode };

export type LoadPhotoLibraryAction = () => Promise<PhotoLibraryResult>;

/**
 * Câu lỗi tải kho ảnh theo mã — giọng ĐỌC (vòng review F18). Thủ tục không có input nên
 * INVALID_INPUT không thể tới; nếu tới thì cũng chỉ là lỗi chung.
 */
export function libraryLoadErrorCopy(code: TransportFailureCode): string {
  return messages.admin.photoLibrary.loadErrors[code === 'INVALID_INPUT' ? 'GENERIC' : code];
}
