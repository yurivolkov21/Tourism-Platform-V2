import { type BookingStatusValue, DecimalStringSchema, type Refund } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { createWriteErrorCodec, type TransportFailureCode } from './api/write-error';
import { formatAmount } from './bookings-view';

/**
 * Logic THUẦN của refund (spec P4b §3-F2) — money-path, nên mọi luật đứng
 * ngoài React và có test riêng: cổng trạng thái, validate amount phía client
 * (bản sao luật contract, trần theo phần CÒN HOÀN ĐƯỢC), phân loại lỗi server.
 *
 * Nguyên tắc xuyên suốt: client KHÔNG bao giờ tự quyết thay server. Nó chỉ
 * chặn sớm những gì contract đã nói chắc chắn (định dạng, > 0, ≤ remainder)
 * rồi hiện NGUYÊN NGHĨA phán quyết của server cho từng mã lỗi.
 */

const t = messages.admin.bookings.refund;

/**
 * Trạng thái còn refund được — khớp gate của `RefundsService.refundByAdmin`:
 * PAID hoặc PARTIALLY_REFUNDED (ledger cho partial cộng dồn). REFUNDED đã
 * settle, PENDING chưa thu tiền, CANCELLED không có gì để hoàn.
 *
 * Đây là điều kiện CẦN chứ chưa đủ: server còn đòi `providerPaymentId`
 * (captured payment) — thứ contract không phơi ra — nên nút vẫn có thể ăn
 * NOT_REFUNDABLE, và đó là lý do mã lỗi ấy có copy riêng.
 */
export function canRefund(status: BookingStatusValue): boolean {
  return status === 'PAID' || status === 'PARTIALLY_REFUNDED';
}

/**
 * Chuẩn hoá chuỗi tiền người dùng gõ TRƯỚC khi validate/gửi: trim + dấu phẩy
 * thập phân → chấm. `inputMode="decimal"` trên bàn phím non-US phát ra `,` —
 * bắt admin học lại dấu chấm là lỗi của form, không phải của họ. Chỉ đổi khi
 * có ĐÚNG MỘT dấu phẩy và không có chấm (kiểu "120,50"); "1,200.50" giữ
 * nguyên cho validate từ chối — đoán nghĩa dấu nghìn là việc quá tay.
 */
export function normalizeAmountInput(raw: string): string {
  const trimmed = raw.trim();
  const commas = trimmed.split(',').length - 1;
  if (commas === 1 && !trimmed.includes('.')) return trimmed.replace(',', '.');
  return trimmed;
}

/**
 * Decimal string → số nguyên CENT, làm tròn HALF_UP ở 2dp đúng như
 * `classifyRefundAmount` làm bằng `Prisma.Decimal` phía server. Đi qua chuỗi
 * chứ không qua float: `0.1 + 0.2` của JS là bài học vỡ lòng, và đây là tiền.
 *
 * Chỉ gọi sau khi chuỗi đã qua `DecimalStringSchema` (không dấu, không âm).
 */
function toCents(value: string): number {
  const [whole = '0', fraction = ''] = value.split('.');
  const cents = Number(`${whole}${`${fraction}00`.slice(0, 2)}`);
  // Chữ số thứ ba quyết định làm tròn: ≥ 5 lên một cent (HALF_UP).
  return Number(fraction[2] ?? '0') >= 5 ? cents + 1 : cents;
}

/** Cent → decimal string 2dp, dạng mà contract và sổ cái dùng ('15.50'). */
function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Phần CÒN HOÀN ĐƯỢC = total − refundedTotal (cả hai là decimal string THẬT
 * từ server — `adminByCode` điền `refundedTotal` từ aggregate ledger, review
 * F2 31/08). Đây là trần validate và là số in ở hint ô amount.
 */
export function remainingRefundable(totalAmount: string, refundedTotal: string): string {
  return fromCents(Math.max(0, toCents(totalAmount) - toCents(refundedTotal)));
}

/**
 * `percent` phần trăm của một số tiền, trả về decimal string 2dp.
 *
 * Ở ĐÂY chứ không ở `approve-refund.ts` vì đây là chỗ duy nhất của repo làm số
 * học trên chuỗi thập phân tiền — `toCents`/`fromCents` không rời file này, và
 * bản chép thứ hai của phép quy đổi ấy là bản chép sẽ lệch.
 *
 * Làm tròn về cent gần nhất, hoà thì LÊN (`Math.round`): 25% của $100.01 là
 * 25,0025 → $25.00, còn 50% của $1,199 là đúng $599.50 không cần tròn. Chọn
 * hướng lên vì nửa cent tranh chấp thì phần thắng thuộc về khách.
 */
export function percentOfAmount(amount: string, percent: number): string {
  return fromCents(Math.round((toCents(amount) * percent) / 100));
}

export type RefundMode = 'full' | 'partial';

export interface RefundAmountInput {
  mode: RefundMode;
  /** Chuỗi ĐÃ qua `normalizeAmountInput` — chỉ có nghĩa ở mode 'partial'. */
  amount: string;
  /** Phần còn hoàn được (`remainingRefundable`) — trần thật, không phải total. */
  remaining: string;
  currency: string;
}

/**
 * Validate amount trước khi bắn — trả câu lỗi i18n, `undefined` là hợp lệ.
 *
 * Mode `full` KHÔNG gửi amount: contract cho phép bỏ trống để server refund
 * đúng phần còn lại. Trần client là `remaining` (total − refundedTotal, cả
 * hai server trả) — hết cảnh cho nhập một số biết trước sẽ ăn OVER_TOTAL ở
 * booking đã hoàn một phần. Server vẫn là phán quyết cuối.
 */
export function validateRefundAmount(input: RefundAmountInput): string | undefined {
  if (input.mode === 'full') return undefined;

  const amount = input.amount;
  if (amount.length === 0) return t.validation.required;
  // Dùng CHÍNH schema của contract, không chép lại regex lần thứ hai.
  if (!DecimalStringSchema.safeParse(amount).success) return t.validation.format;

  const cents = toCents(amount);
  if (cents <= 0) return t.validation.zero;
  if (cents > toCents(input.remaining)) {
    return t.validation.overRemaining(formatAmount(input.remaining, input.currency));
  }
  return undefined;
}

/**
 * Codec lỗi từ khối i18n `refund.errors` — nguồn DUY NHẤT của tập mã contract
 * (review F2 31/08: ba danh sách chép tay từng lệch nhau ngay trong một PR).
 * Bộ ba codes/classify/copy nâng lên `createWriteErrorCodec` ở review F3 để
 * decide/moderate không chép khuôn.
 */
const codec = createWriteErrorCodec(t.errors);

export const REFUND_CONTRACT_CODES = codec.codes;

export type RefundContractCode = keyof typeof t.errors;
export type RefundFailureCode = RefundContractCode | TransportFailureCode;

export const classifyRefundError = codec.classify;
export const refundErrorCopy = codec.copy;

/**
 * Kết quả server action refund. Sống ở LIB (không phải trong component) vì nó
 * là hợp đồng vận chuyển giữa `actions.ts` (server) và panel (client) — tầng
 * server không import từ tầng trình bày (review F2 31/08).
 */
export type RefundActionResult =
  | { ok: true; status: BookingStatusValue; refunds: Refund[] }
  | { ok: false; code: RefundFailureCode };

export type RefundAction = (input: {
  code: string;
  amount?: string;
  reason?: string;
}) => Promise<RefundActionResult>;
