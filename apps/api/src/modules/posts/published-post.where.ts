import type { Prisma } from '../../generated/prisma/client.js';
import { PostStatus } from '../../generated/prisma/enums.js';

/**
 * Điều kiện "bài đã công bố và tới giờ hiển thị" cho MỌI path public đọc Post
 * (ADR-0004). Nhận `now` để test bơm mốc cố định. `publishedAt: null` tự bị
 * loại vì null không thoả `lte` — bài PUBLISHED chưa đặt ngày sẽ KHÔNG hiện.
 */
export function publishedPostWhere(now: Date = new Date()): Prisma.PostWhereInput {
  return { status: PostStatus.PUBLISHED, publishedAt: { lte: now } };
}
