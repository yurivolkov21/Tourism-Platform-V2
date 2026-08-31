import { messages } from '@tourism/i18n';
import {
  classifyWriteError,
  type TransportFailureCode,
  transportErrorCopy,
} from './api/write-error';

/**
 * Logic THUẦN của quyết định cancellation (spec P4b §3-F3). Approve là
 * money-path (refund phần còn lại + huỷ booking + nhả ghế), nên luật phân
 * loại lỗi đứng ngoài React và có test riêng — đúng khuôn `refund.ts` của F2.
 */

const t = messages.admin.cancellations.decide;

/**
 * Tập mã CONTRACT của `admin.cancellations.decide` — derive từ keys khối i18n
 * `decide.errors` (nguồn DUY NHẤT, nếp F2: ba danh sách chép tay từng lệch
 * nhau ngay trong một PR). Thêm mã vào contract → thêm câu vào i18n là mọi
 * nơi tự khớp; quên thì test đối chiếu với `errorMap` của contract đỏ.
 */
export const DECIDE_CONTRACT_CODES = new Set(
  Object.keys(t.errors) as (keyof typeof t.errors)[],
) as ReadonlySet<keyof typeof t.errors>;

export type DecideContractCode = keyof typeof t.errors;
export type DecideFailureCode = DecideContractCode | TransportFailureCode;

/** Lỗi ném từ client oRPC → mã UI. Chạy phía SERVER (xem `classifyWriteError`). */
export function classifyDecideError(error: unknown): DecideFailureCode {
  return classifyWriteError(error, DECIDE_CONTRACT_CODES);
}

/** Mã → câu cho admin. Mỗi mã một câu, không có nhánh gộp (bất biến §2.4). */
export function decideErrorCopy(code: DecideFailureCode): string {
  return DECIDE_CONTRACT_CODES.has(code as DecideContractCode)
    ? t.errors[code as DecideContractCode]
    : transportErrorCopy(code as TransportFailureCode);
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
