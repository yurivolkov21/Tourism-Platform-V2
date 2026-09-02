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
    // Cố ý không gửi — không phải thành công, không phải lỗi: viền trơn.
    case 'SKIPPED':
      return 'outline';
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
 * Row từng được admin retry? Retry đặt `attempts = 0` nhưng GIỮ `lastError`,
 * và worker chỉ ghi đè lỗi khi lượt mới cũng hỏng — nên "attempts 0 mà còn
 * lỗi" là dấu vết duy nhất (contract ghi rõ, vòng vá review F7). FAILED thì
 * không tính: hàng FAILED luôn có lỗi và attempts = trần.
 */
export function wasRetried(row: Pick<OutboxRow, 'status' | 'attempts' | 'lastError'>): boolean {
  return row.status !== 'FAILED' && row.attempts === 0 && row.lastError !== null;
}

/**
 * Cột Attempts — nói đúng LỊCH SỬ giao hàng, không chỉ con số:
 * - PENDING/FAILED: "n/max" — đã dùng bao nhiêu lượt trên trần của worker;
 *   PENDING vừa được xếp lại thì "Re-queued by an operator" thay cho "0/5"
 *   (0/5 kèm một lỗi đỏ đọc như hàng mới mà lỗi còn nguyên).
 * - SENT: `attempts` là số lần HỎNG trước khi đi được — "First try" / "After
 *   2 failed tries"; nhưng SENT sau một cú retry thì attempts đã về 0, in
 *   "First try" cho hàng phải can thiệp tay là nói dối (vòng vá review F7)
 *   → "Sent after a manual retry".
 * - SKIPPED: worker cố ý không gửi — nói thẳng lý do.
 */
function attemptsLabel(row: Pick<OutboxRow, 'status' | 'attempts' | 'lastError'>): string {
  if (row.status === 'SKIPPED') return t.list.skipped;
  const retried = wasRetried(row);
  if (row.status === 'SENT') {
    if (retried) return t.list.sentAfterRetry;
    return row.attempts === 0 ? t.list.sentFirstTry : t.list.sentAfterRetries(row.attempts);
  }
  if (retried) return t.list.requeued;
  return t.list.attempts(row.attempts, OUTBOX_MAX_ATTEMPTS);
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
  /**
   * Payload THÔ (đã redact ở API) — drawer tự thụt lề khi mở. Không nấu sẵn
   * chuỗi cho cả trang (vòng vá review F7): 100 payload thụt lề đi vào RSC
   * flight mỗi lần đổi trang chỉ để một row được mở.
   */
  payload: OutboxRow['payload'];
  /** Row từng được admin xếp lại — bảng/drawer nhắc bằng nhãn Attempts. */
  retried: boolean;
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
    attemptsLabel: attemptsLabel(row),
    lastError: row.lastError,
    created: formatDateTime(row.createdAt),
    processed: row.processedAt ? formatDateTime(row.processedAt) : null,
    dedupeKey: row.dedupeKey,
    payload: row.payload,
    retried: wasRetried(row),
    canRetry: canRetry(row.status),
  };
}
