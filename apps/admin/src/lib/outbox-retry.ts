import { OUTBOX_MAX_ATTEMPTS } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { createWriteErrorCodec, type TransportFailureCode } from './api/write-error';

/**
 * Logic THUẦN của hành vi retry outbox (spec P4c §3-F7) — cùng khuôn
 * `cancellations-decide.ts`: codec lỗi derive từ khối i18n, luật trạng-thái-
 * cũ, hợp đồng vận chuyển của server action, và copy dialog dựng sẵn để
 * component không tự ghép chuỗi.
 */

const t = messages.admin.outbox.retry;

/**
 * Codec lỗi từ khối i18n `retry.errors` (nguồn DUY NHẤT của tập mã contract —
 * test đối chiếu với `errorMap` của contract).
 */
/**
 * CẢ HAI mã contract đều là trạng-thái-cũ: hàng đã biến mất (purge) hoặc đã
 * rời FAILED (admin khác retry trước, hay worker vừa gửi được). Không có mã
 * "thử lại tại chỗ": retry không đi qua provider nào để mà bị từ chối — nếu
 * hàng còn FAILED thì câu UPDATE luôn ăn. Khai ngay trong codec (vòng vá
 * review F7) — không còn predicate tay.
 */
const codec = createWriteErrorCodec(t.errors, { stale: ['NOT_FOUND', 'NOT_FAILED'] });

export const RETRY_CONTRACT_CODES = codec.codes;

export type RetryContractCode = keyof typeof t.errors;
export type RetryFailureCode = RetryContractCode | TransportFailureCode;

export const classifyRetryError = codec.classify;
export const retryErrorCopy = codec.copy;
export const isStaleStateCode = codec.isStale;

/**
 * Kết quả server action retry — hợp đồng vận chuyển giữa `actions.ts` (server)
 * và dialog (client), sống ở lib để tầng server không import tầng trình bày.
 * Nhánh thành công trả `dedupeKey` để toast gọi đúng tên hàng vừa xếp lại.
 */
export type RetryActionResult =
  | { ok: true; dedupeKey: string }
  | { ok: false; code: RetryFailureCode };

export type RetryAction = (input: { id: string }) => Promise<RetryActionResult>;

/** Phần hàng mà dialog xác nhận cần — bảng cắt ĐÚNG các field này từ VM. */
export interface RetryTarget {
  typeLabel: string;
  recipient: string | null;
  dedupeKey: string;
  lastError: string | null;
}

/**
 * Copy của dialog — KHÔNG có ô note (retry không mang ghi chú đi đâu; kit
 * `ConfirmWriteDialog` bỏ ô khi không truyền `noteId`). Câu cảnh báo mang
 * trần attempts từ CONTRACT, không viết cứng "5".
 */
export function retryDialogCopy() {
  return {
    title: t.dialog.title,
    body: t.dialog.body,
    warning: t.dialog.warning(OUTBOX_MAX_ATTEMPTS),
    submit: t.dialog.submit,
    submitting: t.dialog.submitting,
    cancel: t.cancel,
  };
}

/**
 * Dòng ngữ cảnh của dialog: type · recipient · dedupeKey · lastError. Lỗi
 * null thì BỎ dòng (không có gì để kể); recipient null thì in chữ thay thế —
 * admin phải thấy rõ email này sẽ KHÔNG có người nhận trước khi xếp lại.
 */
export function retryConfirmRows(target: RetryTarget): Array<{ label: string; value: string }> {
  return [
    { label: t.type, value: target.typeLabel },
    { label: t.recipient, value: target.recipient ?? messages.admin.outbox.list.noRecipient },
    { label: t.dedupeKey, value: target.dedupeKey },
    ...(target.lastError ? [{ label: t.lastError, value: target.lastError }] : []),
  ];
}
