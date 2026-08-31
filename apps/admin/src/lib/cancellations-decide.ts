import { messages } from '@tourism/i18n';
import { createWriteErrorCodec, type TransportFailureCode } from './api/write-error';

/**
 * Logic THUẦN của quyết định cancellation (spec P4b §3-F3). Approve là
 * money-path (refund phần còn lại + huỷ booking + nhả ghế), nên luật phân
 * loại lỗi đứng ngoài React và có test riêng — đúng khuôn `refund.ts` của F2.
 */

const t = messages.admin.cancellations.decide;

/**
 * Codec lỗi từ khối i18n `decide.errors` (nguồn DUY NHẤT của tập mã contract
 * — test đối chiếu với `errorMap` của contract). Bộ ba codes/classify/copy
 * từng bị chép nguyên từ refund.ts → nâng lên `createWriteErrorCodec` ở review
 * F3 31/08.
 */
const codec = createWriteErrorCodec(t.errors);

export const DECIDE_CONTRACT_CODES = codec.codes;

export type DecideContractCode = keyof typeof t.errors;
export type DecideFailureCode = DecideContractCode | TransportFailureCode;

export const classifyDecideError = codec.classify;
export const decideErrorCopy = codec.copy;

/**
 * Mã TRẠNG-THÁI-CŨ: lệnh không sửa được tại chỗ vì thế giới đã đổi dưới chân
 * dialog (request bị quyết bởi người khác, biến mất, hay booking hết phần
 * hoàn được). UI xử: đóng dialog + toast + refresh queue — copy của ba mã này
 * hứa "the queue has been refreshed" nên UI PHẢI làm thật (review F3 31/08).
 * REFUND_FAILED không thuộc nhóm này: provider từ chối, request còn nguyên
 * REQUESTED, thử lại tại chỗ là hợp lệ.
 */
export function isStaleStateCode(code: DecideFailureCode): boolean {
  return code === 'NOT_FOUND' || code === 'ALREADY_DECIDED' || code === 'NOT_REFUNDABLE';
}

/**
 * Kết quả server action decide. Sống ở LIB (không phải trong component) vì nó
 * là hợp đồng vận chuyển giữa `actions.ts` (server) và dialog (client) — tầng
 * server không import từ tầng trình bày (review F2 31/08).
 *
 * Nhánh thành công trả về `approved` + `bookingCode` để toast nói đúng chuyện
 * vừa xảy ra; dữ liệu bảng thì `router.refresh()` kéo về, client KHÔNG giữ
 * bản sao trạng thái nào.
 */
export type DecideActionResult =
  | { ok: true; approved: boolean; bookingCode: string }
  | { ok: false; code: DecideFailureCode };

export type DecideAction = (input: {
  id: string;
  approve: boolean;
  decisionNote?: string;
}) => Promise<DecideActionResult>;
