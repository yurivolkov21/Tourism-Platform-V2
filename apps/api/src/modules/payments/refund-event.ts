import { Prisma } from '../../generated/prisma/client.js';
import type { PaymentProvider } from '../../generated/prisma/enums.js';

/**
 * Dựng row `payment_events` cho MỘT khoản hoàn ta chủ động phát (ADR-0043 §3).
 * THUẦN — unit test không cần DB; người gọi ghi nó bằng transaction đang ghi
 * dòng sổ `refunds`, tức vẫn trong advisory lock của ADR-0009.
 *
 * Vì sao lõi hoàn tiền tự ghi thay vì đợi webhook echo: với Stripe,
 * `data.object` của `charge.refunded` là một Charge — nó KHÔNG mang
 * `metadata.bookingId` (ta chỉ đặt metadata trên Checkout Session) lẫn
 * `amount_total` mà `mapStripeEvent` đọc, nên echo về chỉ thành row
 * `other`/không gắn booking. Row ở đây không phải dữ liệu bịa: cổng THẬT SỰ có
 * phát event hoàn, ta chỉ ghi nó từ response của API refund thay vì đợi echo.
 *
 * Ba chỗ có luật, cả ba đều sai âm thầm được nếu chép ẩu:
 * - `eventId` lấy id refund của CỔNG. Khoá `@@unique([provider, eventId])` chỉ
 *   chống trùng thật khi nó mang id provider; id dòng sổ thì một echo về sau
 *   chèn được row thứ hai cho cùng khoản hoàn.
 * - Hai mốc bằng ĐÚNG `refunds.created_at` của dòng sổ vừa ghi — không phải
 *   `new Date()`. Bất biến nghiệm thu seed so hai mốc bằng `=`, nên lệch một
 *   phần nghìn giây là đỏ.
 * - Tiền vào payload dưới dạng chuỗi 2 số lẻ (nếp `money` toàn repo: JSON
 *   không bao giờ mang Decimal hay float).
 */
export interface RefundEventInput {
  provider: PaymentProvider;
  bookingId: string;
  /** Id dòng sổ `refunds` vừa ghi — chỉ vào payload, KHÔNG làm `eventId`. */
  refundId: string;
  /** Id refund phía cổng (`re_…` / id refund PayPal) — thành `eventId`. */
  providerRefundId: string;
  /** Capture được hoàn vào (`Booking.providerPaymentId`). */
  providerPaymentId: string;
  amount: Prisma.Decimal;
  currency: string;
  /** Đường nào phát khoản hoàn này — đọc được ở drawer của admin. */
  cause: RefundEventCause;
  /** `refunds.created_at` của chính dòng sổ đi cùng row này. */
  at: Date;
}

/**
 * `admin` — hoàn thiện chí (`RefundsService.refundByAdmin`);
 * `cancel` — khách tự huỷ (`CancellationsService.cancelInLock`, ADR-0041);
 * `auto` — money-path tự hoàn (`PaymentsService`, ADR-0006).
 */
export type RefundEventCause = 'admin' | 'cancel' | 'auto';

export function buildRefundEventRow(input: RefundEventInput): Prisma.PaymentEventCreateInput {
  const amount = input.amount.toFixed(2);
  return {
    provider: input.provider,
    eventId: input.providerRefundId,
    type: 'payment.refunded',
    // `source` nói thẳng row này do ta ghi — đọc drawer không hiểu nhầm là
    // payload provider (redactDeep vẫn quét nó như mọi payload khác).
    payload: {
      source: 'refund-core',
      cause: input.cause,
      refundId: input.refundId,
      providerRefundId: input.providerRefundId,
      providerPaymentId: input.providerPaymentId,
      amount,
      currency: input.currency,
    },
    amount: input.amount,
    currency: input.currency,
    bookingId: input.bookingId,
    processedAt: input.at,
    receivedAt: input.at,
  };
}
