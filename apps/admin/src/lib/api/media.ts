import type { AdminMediaItem, AdminMediaQueue, AdminMediaUpdateInput } from '@tourism/contract';
import { api, withAdminAuth } from './client';

/**
 * Các đường của Media library — bọc mỏng `admin.media.*` (ADR-0060). KHÔNG nuốt lỗi ở đường ghi:
 * mã contract phải tới server action nguyên vẹn để đổi thành mã UI.
 *
 * KHÔNG cache: `router.refresh()` sau mỗi lần lưu phải kéo về đúng version mới của ảnh.
 */

/** Mọi ảnh đang dùng, ảnh thêm gần nhất lên trước — không phân trang (ADR-0060 §2). */
export async function fetchAdminMedia(cookie: string): Promise<AdminMediaItem[]> {
  return api.admin.media.list(undefined, { context: withAdminAuth(cookie) });
}

/** Hàng dọn, chỉ đọc (ADR-0060 §4). */
export async function fetchAdminMediaQueue(cookie: string): Promise<AdminMediaQueue> {
  return api.admin.media.queue(undefined, { context: withAdminAuth(cookie) });
}

export async function updateAdminMedia(
  cookie: string,
  input: AdminMediaUpdateInput,
): Promise<AdminMediaItem> {
  return api.admin.media.update(input, { context: withAdminAuth(cookie) });
}
