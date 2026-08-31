import { ORPCError } from '@orpc/client';
import { type BookingStatusValue, DecimalStringSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { formatAmount } from './bookings-view';

/**
 * Logic THUẦN của refund (spec P4b §3-F2) — money-path, nên mọi luật đứng
 * ngoài React và có test riêng: cổng trạng thái, validate amount phía client
 * (bản sao luật contract), phân loại lỗi server và cộng sổ cái.
 *
 * Nguyên tắc xuyên suốt: client KHÔNG bao giờ tự quyết thay server. Nó chỉ
 * chặn sớm những gì contract đã nói chắc chắn (định dạng, > 0, ≤ total) rồi
 * hiện NGUYÊN NGHĨA phán quyết của server cho từng mã lỗi.
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

export type RefundMode = 'full' | 'partial';

export interface RefundAmountInput {
  mode: RefundMode;
  /** Chuỗi thô người dùng gõ (chưa trim) — chỉ có nghĩa ở mode 'partial'. */
  amount: string;
  /** `booking.totalAmount` — trần DUY NHẤT client biết chắc. */
  totalAmount: string;
  currency: string;
}

/**
 * Validate amount trước khi bắn — trả câu lỗi i18n, `undefined` là hợp lệ.
 *
 * Mode `full` KHÔNG gửi amount: contract cho phép bỏ trống để server refund
 * đúng phần còn lại (total − SUM(refunds)). Đó cũng là lý do client không
 * được tự điền total vào ô: với booking PARTIALLY_REFUNDED, phần đã hoàn
 * KHÔNG có trong `admin.bookings.byCode` (`refundedTotal` luôn '0.00' ở mọi
 * call site trừ `bookings.byCode`), nên trần thật chỉ server biết. Client vì
 * vậy chặn tới đúng `totalAmount` — chặt hơn thế là đoán mò, và OVER_TOTAL
 * của server mới là phán quyết cuối.
 */
export function validateRefundAmount(input: RefundAmountInput): string | undefined {
  if (input.mode === 'full') return undefined;

  const amount = input.amount.trim();
  if (amount.length === 0) return t.validation.required;
  // Dùng CHÍNH schema của contract, không chép lại regex lần thứ hai.
  if (!DecimalStringSchema.safeParse(amount).success) return t.validation.format;

  const cents = toCents(amount);
  if (cents <= 0) return t.validation.zero;
  if (cents > toCents(input.totalAmount)) {
    return t.validation.overTotal(formatAmount(input.totalAmount, input.currency));
  }
  return undefined;
}

/**
 * Mã lỗi refund như UI phân biệt: SÁU mã của contract (5 mã ledger 422/502 +
 * NOT_FOUND) giữ nguyên tên, cộng ba mã tầng vận chuyển. Thứ tự trong mảng là
 * thứ tự khai báo ở contract — mảng tồn tại để test soi được "mỗi mã một câu".
 */
export const REFUND_FAILURE_CODES = [
  'NOT_FOUND',
  'NOT_REFUNDABLE',
  'OVER_TOTAL',
  'ZERO_OR_NEGATIVE',
  'NOTHING_LEFT',
  'REFUND_FAILED',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'GENERIC',
] as const;

export type RefundFailureCode = (typeof REFUND_FAILURE_CODES)[number];

/** Sáu mã đến từ `contract.admin.bookings.refund.errors` — nhận diện theo `code`. */
const CONTRACT_CODES = new Set<string>([
  'NOT_FOUND',
  'NOT_REFUNDABLE',
  'OVER_TOTAL',
  'ZERO_OR_NEGATIVE',
  'NOTHING_LEFT',
  'REFUND_FAILED',
]);

/**
 * Lỗi ném ra từ client oRPC → mã UI. Chạy phía SERVER (trong server action):
 * `ORPCError` không sống sót qua ranh giới action, nên action phân loại xong
 * mới trả mã xuống client.
 *
 * Ưu tiên `code` của contract hơn `status`: hai mã 422 khác nhau cùng status,
 * và chính sự phân biệt đó là bất biến spec §2.4.
 */
export function classifyRefundError(error: unknown): RefundFailureCode {
  if (error instanceof ORPCError) {
    if (CONTRACT_CODES.has(error.code)) return error.code as RefundFailureCode;
    if (error.status === 401) return 'UNAUTHORIZED';
    if (error.status === 403) return 'FORBIDDEN';
  }
  return 'GENERIC';
}

/** Mã → câu cho admin. Mỗi mã một câu, không có nhánh gộp (bất biến §2.4). */
export function refundErrorCopy(code: RefundFailureCode): string {
  return t.errors[code];
}

/**
 * Câu giải thích ô sổ cái khi trang CHƯA có ledger thật trong tay.
 *
 * `admin.bookings.byCode` không đọc bảng refund (và `refundedTotal` nó trả về
 * luôn là '0.00' — xem `toBooking`), nên trang chi tiết chỉ có sổ cái thật sau
 * khi chính nó phát một refund. Ba câu chứ không phải một, vì trạng thái nói
 * được ba chuyện KHÁC nhau và không được nói quá:
 *
 * - PENDING/PAID: bảo đảm chưa có refund row nào (mọi refund đều đẩy status
 *   sang PARTIALLY_REFUNDED/REFUNDED/CANCELLED).
 * - PARTIALLY_REFUNDED/REFUNDED: chắc chắn CÓ, chỉ là không biết bao nhiêu.
 * - CANCELLED: có thể mang auto-refund (overbook / orphaned capture — xem
 *   `PaymentsService.refundOverbooked`) hoặc không mang gì. Không đoán.
 */
export function ledgerNote(status: BookingStatusValue): string {
  switch (status) {
    case 'PENDING':
    case 'PAID':
      return t.ledger.none;
    case 'PARTIALLY_REFUNDED':
    case 'REFUNDED':
      return t.ledger.onRecord;
    case 'CANCELLED':
      return t.ledger.unknown;
  }
}

/**
 * Tổng đã hoàn theo sổ cái refund THẬT do `admin.bookings.refund` trả về
 * (`historyForBooking` — toàn bộ row của booking, không phải mỗi lần vừa
 * phát). Cộng bằng cent vì đây là con số admin đối chiếu với provider.
 */
export function sumRefunds(refunds: readonly { amount: string }[]): string {
  return fromCents(refunds.reduce((total, refund) => total + toCents(refund.amount), 0));
}
