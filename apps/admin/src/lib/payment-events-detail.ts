import type { PaymentEventDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { classifyWriteError, type TransportFailureCode } from './api/write-error';

/**
 * Logic THUẦN của đường tải payload cho drawer `/payment-events` (spec P4c
 * §3-F8): list không mang payload, drawer gọi `admin.paymentEvents.byId` khi
 * mở qua một SERVER ACTION đọc (quyết định tự chọn F8 — client oRPC của admin
 * chỉ có đường server đọc cookie từ `next/headers`; route handler thì phải tự
 * gác quyền như `bookings/export`, mà ở đây không có file để trả). Hợp đồng
 * vận chuyển giữa action (server) và drawer (client) sống ở lib để tầng
 * server không import tầng trình bày (nếp `outbox-retry.ts`).
 */

const t = messages.admin.paymentEvents.detail;

/** Mã contract duy nhất của `byId`. */
const CONTRACT_CODES: ReadonlySet<'NOT_FOUND'> = new Set(['NOT_FOUND']);

export type LoadFailureCode = 'NOT_FOUND' | TransportFailureCode;

/**
 * Phân loại lỗi của `byId` — tái dùng `classifyWriteError` vì phần nó làm
 * (con dấu `isDefinedError` + thử thành viên + 401/403) không phụ thuộc đọc
 * hay ghi; chỉ COPY mới khác giọng (xem `loadErrorCopy`).
 */
export function classifyLoadError(error: unknown): LoadFailureCode {
  return classifyWriteError(error, CONTRACT_CODES);
}

/**
 * Câu cho từng mã — giọng ĐỌC từ `detail.errors`, không mượn `errors.write`
 * (câu đó cố ý mập mờ "có thể đã đi qua"). `INVALID_INPUT` chỉ xảy ra khi
 * action nhận id hỏng — với người đọc là "không tải được", tức GENERIC.
 */
export function loadErrorCopy(code: LoadFailureCode): string {
  return code === 'INVALID_INPUT' ? t.errors.GENERIC : t.errors[code];
}

/** Kết quả server action tải một event — nhánh thành công mang đủ detail. */
export type PaymentEventLoadResult =
  | { ok: true; event: PaymentEventDetail }
  | { ok: false; code: LoadFailureCode };

export type PaymentEventLoader = (input: { id: string }) => Promise<PaymentEventLoadResult>;
