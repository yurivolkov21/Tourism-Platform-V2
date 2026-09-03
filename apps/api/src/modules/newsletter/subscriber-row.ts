import type { SubscriberRow } from '@tourism/contract';
import type { Prisma } from '../../generated/prisma/client.js';

/**
 * Row Prisma `subscribers` → `SubscriberRow` của contract (spec P4c §3-F10).
 * THUẦN — unit test không cần DB.
 *
 * `select` sống Ở ĐÂY cạnh mapper đọc nó, và kiểu row derive bằng
 * `Prisma.SubscriberGetPayload` từ chính nó (nếp F9): chép tay một interface
 * mirror object select là bỏ một cột khỏi select mà TypeScript vẫn im lặng,
 * rồi `undefined` lọt vào contract lúc chạy. Service chỉ `import`.
 *
 * Hai luật đáng đọc:
 *
 * 1. **Không có `updatedAt`.** Cột đó là `@updatedAt` nên MỌI lệnh ghi đều
 *    đè; chở nó xuống bảng là mời người đọc dùng một mốc "chạm lần cuối" để
 *    trả lời câu hỏi mà `createdAt`/`unsubscribedAt` đã trả lời chính xác
 *    hơn (đúng bài học `EnquiryRow` bỏ `phone`/`tourSlug` ở vòng vá F9).
 * 2. **Null đi thẳng qua, không rơi về chuỗi thay thế.** `source` null là
 *    câu trả lời phổ biến nhất hôm nay (form footer gọi `subscribe({email})`
 *    không kèm nguồn) và `unsubscribedAt` null nghĩa là "còn nhận tin" —
 *    chỗ dịch hai cái null ấy thành chữ cho mắt người là VM bên admin, không
 *    phải ở đây.
 */

/** Năm cột của một hàng bảng — xem luật 1 ở trên. */
export const LIST_SELECT = {
  id: true,
  email: true,
  source: true,
  createdAt: true,
  unsubscribedAt: true,
} satisfies Prisma.SubscriberSelect;

export type SubscriberListRow = Prisma.SubscriberGetPayload<{ select: typeof LIST_SELECT }>;

export function toSubscriberRow(row: SubscriberListRow): SubscriberRow {
  return {
    id: row.id,
    email: row.email,
    source: row.source,
    createdAt: row.createdAt.toISOString(),
    unsubscribedAt: row.unsubscribedAt ? row.unsubscribedAt.toISOString() : null,
  };
}
