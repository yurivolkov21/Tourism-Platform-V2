import {
  type EmailTypeValue,
  OUTBOX_MAX_ATTEMPTS,
  type OutboxRow,
  type OutboxStatusValue,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { formatDateTime } from './bookings-view';

/**
 * Mapper hiển thị bảng `/outbox` (spec P4c §3-F7) — THUẦN, ngoài React nên
 * test được từng nhánh; bảng và drawer chỉ render VM có sẵn.
 *
 * Ngày giờ mượn `formatDateTime` của `bookings-view` (in UTC) — một luật đọc
 * thời gian cho cả back-office.
 */

const t = messages.admin.outbox;

/**
 * Variant Badge — luật màu là DỮ LIỆU. FAILED tô destructive vì đây là trạng
 * thái "cần người" và là lý do trang tồn tại; PENDING nhạt (đang xếp hàng,
 * worker sẽ lo); SENT mặc định (chuyện đã xong).
 */
export function outboxStatusBadgeVariant(
  status: OutboxStatusValue,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'FAILED':
      return 'destructive';
    case 'PENDING':
      return 'secondary';
    default:
      return 'default';
  }
}

/**
 * Còn retry được không? Chỉ FAILED — hàng PENDING đã ở trong hàng đợi, hàng
 * SENT đã đi. Server gác đúng luật này (409 NOT_FAILED); đây là cổng sớm
 * phía UI.
 */
export function canRetry(status: OutboxStatusValue): boolean {
  return status === 'FAILED';
}

/**
 * Cột Attempts. PENDING/FAILED: "n/max" — đã dùng bao nhiêu lượt trên trần
 * của worker. SENT thì "0/5" vô nghĩa (email đã đi): `attempts` ở hàng SENT
 * là số lần HỎNG trước khi đi được, nên nói đúng chuyện đó — "First try" hay
 * "After 2 failed tries". Quyết định tự chọn của F7 (spec để ngỏ).
 */
function attemptsLabel(status: OutboxStatusValue, attempts: number): string {
  if (status !== 'SENT') return t.list.attempts(attempts, OUTBOX_MAX_ATTEMPTS);
  return attempts === 0 ? t.list.sentFirstTry : t.list.sentAfterRetries(attempts);
}

/** Một hàng của bảng `/outbox` — cũng là dữ liệu của drawer chi tiết. */
export interface OutboxRowVM {
  id: string;
  type: EmailTypeValue;
  typeLabel: string;
  /** null = payload không có `to`/`email`; bảng in chữ thay thế. */
  recipient: string | null;
  status: OutboxStatusValue;
  statusLabel: string;
  attempts: number;
  attemptsLabel: string;
  /** Nguyên văn — bảng cắt bằng CSS + `title`, drawer in đủ. */
  lastError: string | null;
  created: string;
  processed: string | null;
  dedupeKey: string;
  /** Payload thụt lề 2 khoảng — drawer in trong khối mono cuộn (spec §2.3). */
  payloadJson: string;
  canRetry: boolean;
}

/** Row của contract → hàng bảng đã format sẵn (server component gọi). */
export function toOutboxRowVM(row: OutboxRow): OutboxRowVM {
  return {
    id: row.id,
    type: row.type,
    typeLabel: t.type[row.type],
    recipient: row.recipient,
    status: row.status,
    statusLabel: t.status[row.status],
    attempts: row.attempts,
    attemptsLabel: attemptsLabel(row.status, row.attempts),
    lastError: row.lastError,
    created: formatDateTime(row.createdAt),
    processed: row.processedAt ? formatDateTime(row.processedAt) : null,
    dedupeKey: row.dedupeKey,
    payloadJson: JSON.stringify(row.payload, null, 2),
    canRetry: canRetry(row.status),
  };
}
