import type { OutboxRow } from '@tourism/contract';
import type { Outbox } from '../../generated/prisma/client.js';
import { resolveRecipient } from '../../worker/recipient.js';

/**
 * Row Prisma `outbox` → `OutboxRow` của contract (spec P4c §3-F7). THUẦN —
 * unit test không cần DB.
 *
 * `recipient` rút bằng ĐÚNG hàm worker dùng để gửi (`resolveRecipient`: `to`
 * thắng `email`) chứ không chép luật lần hai: cột Recipient của admin phải
 * nói đúng địa chỉ mà deliverer sẽ bắn tới, kể cả ENQUIRY_ADMIN_ALERT (ở đó
 * `email` là địa chỉ KHÁCH, người nhận là admin qua `to`).
 *
 * `payload` đi nguyên văn: JSON là dữ liệu để soi trong drawer, không phải
 * giao diện (spec §2.3). Giá trị Prisma `JsonValue` đã là JSON hợp lệ nên
 * không cần chuyển đổi gì.
 */
export function toOutboxRow(row: Outbox): OutboxRow {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    attempts: row.attempts,
    dedupeKey: row.dedupeKey,
    lastError: row.lastError,
    createdAt: row.createdAt.toISOString(),
    processedAt: row.processedAt ? row.processedAt.toISOString() : null,
    recipient: resolveRecipient(row.payload) ?? null,
    // Cùng một tập giá trị JSON, hai cách gõ: Prisma khai `JsonArray` là
    // interface kế thừa Array nên TS không khớp nó với union đệ quy `JSONType`
    // của `z.json()`. Cast là khớp DANH NGHĨA, không đổi giá trị.
    payload: row.payload as OutboxRow['payload'],
  };
}
