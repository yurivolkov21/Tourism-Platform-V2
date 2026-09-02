import type { PaymentEventDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { createWriteErrorCodec, type TransportFailureCode } from './api/write-error';

/**
 * Logic THUẦN của đường tải payload cho drawer `/payment-events` (spec P4c
 * §3-F8): list không mang payload, drawer gọi `admin.paymentEvents.byId` khi
 * mở qua một SERVER ACTION đọc (quyết định tự chọn F8 — client oRPC của admin
 * chỉ có đường server đọc cookie từ `next/headers`; route handler thì phải tự
 * gác quyền như `bookings/export`, mà ở đây không có file để trả). Hợp đồng
 * vận chuyển giữa action (server) và drawer (client) sống ở lib để tầng
 * server không import tầng trình bày (nếp `outbox-retry.ts`).
 *
 * Tập mã + phân loại + câu đi qua CÙNG codec với các hành vi ghi (vòng vá
 * review F8 — bản đầu chép tay bộ ba `CONTRACT_CODES`/classify/copy). Khác
 * duy nhất là GIỌNG câu transport: đọc, không mượn `errors.write` ("có thể
 * đã đi qua" — ở đây không có gì để lỡ đi qua), khai qua `transportCopy`.
 * `INVALID_INPUT` chỉ xảy ra khi action nhận id hỏng — với người đọc là
 * "không tải được", tức câu GENERIC.
 */

const t = messages.admin.paymentEvents.detail;

const codec = createWriteErrorCodec(t.errors, {
  transportCopy: { ...t.transportErrors, INVALID_INPUT: t.transportErrors.GENERIC },
});

export type LoadFailureCode = keyof typeof t.errors | TransportFailureCode;

/** Tập mã contract của `byId` — test đối chiếu với `errorMap` thật. */
export const LOAD_CONTRACT_CODES = codec.codes;

/** Phân loại lỗi của `byId` — chạy phía SERVER (trong server action). */
export const classifyLoadError: (error: unknown) => LoadFailureCode = codec.classify;

/** Câu cho từng mã — giọng ĐỌC. */
export const loadErrorCopy: (code: LoadFailureCode) => string = codec.copy;

/** Kết quả server action tải một event — nhánh thành công mang đủ detail. */
export type PaymentEventLoadResult =
  | { ok: true; event: PaymentEventDetail }
  | { ok: false; code: LoadFailureCode };

export type PaymentEventLoader = (input: { id: string }) => Promise<PaymentEventLoadResult>;
