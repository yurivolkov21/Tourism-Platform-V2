import { Prisma } from '../../generated/prisma/client.js';

/**
 * Phần THUẦN của mô hình tài chính (ADR-0033) — không đụng DB, nên mọi biên
 * làm tròn và mọi ca LỖ test được mà không cần dựng một tháng thua lỗ trong
 * Postgres. Aggregate thật ở `stats-aggregates.ts`, ghép ở `reports.service.ts`.
 *
 * Tỉ lệ vào là `number` (đọc từ env, luôn là hằng nhỏ), tiền vào-ra là
 * `Prisma.Decimal` — tiền không bao giờ đi qua float (CLAUDE.md).
 */

const ZERO = new Prisma.Decimal(0);

/**
 * Thuế trên MARGIN theo Tour Operators' Margin Scheme (ADR-0033 §5).
 *
 * Ngành lữ hành nộp thuế trên phần chênh giữa giá bán và giá vốn dịch vụ mua
 * vào, không trên toàn bộ giá bán. Và giá bán ĐÃ BAO GỒM thuế, nên phần thuế
 * nằm TRONG margin và phải **bóc ra** bằng `rate/(1+rate)` — nhân thẳng `rate`
 * là thu quá tay đúng bằng `rate` lần nữa. Ở mức 20% công thức này ra đúng
 * *một phần sáu của margin*, con số nghề nghiệp hay nói.
 *
 * `grossProfit <= 0` trả 0, và đó là LUẬT của scheme chứ không phải một phép
 * phòng thủ: margin âm thì không có gì để nộp. Bỏ vế ấy đi là sinh ra một
 * khoản thuế ÂM cộng vào lợi nhuận — tháng càng lỗ càng "được hoàn thuế".
 */
export function taxOnMargin(grossProfit: Prisma.Decimal, rate: number): Prisma.Decimal {
  if (rate <= 0 || grossProfit.lte(ZERO)) return ZERO;

  return grossProfit
    .mul(rate)
    .div(1 + rate)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/**
 * Phí cổng thanh toán ước tính (ADR-0033 §6).
 *
 * Mỗi booking là MỘT giao dịch, nên phần cố định nhân với số booking chứ không
 * tính một lần cho cả kỳ — một tháng 40 booking nhỏ tốn phí cố định gấp mười
 * một tháng 4 booking lớn cùng doanh số.
 *
 * Ước tính chứ không phải phí thật: phí thật nằm trong `balance_transaction`
 * của Stripe, tức thêm một lượt gọi API cho mỗi payment và một cột để lưu.
 * Đường nâng cấp (thêm `fee_amount` trên `payment_events`) ghi ở ADR-0033 §6 —
 * cộng thêm, không phải viết lại.
 */
export function paymentFees(
  grossCollected: Prisma.Decimal,
  transactions: number,
  rate: number,
  fixedPerTransaction: number,
): Prisma.Decimal {
  return grossCollected
    .mul(rate)
    .add(new Prisma.Decimal(fixedPerTransaction).mul(transactions))
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
}

/**
 * Biên gộp dạng TỈ LỆ (0.4 = 40%) — client nhân 100 khi in.
 *
 * `null` khi mẫu số 0, KHÔNG phải 0: một tháng không có chuyến nào chạy có
 * biên gộp **không xác định**, còn `0.0%` là một câu khác hẳn — nó nói tháng
 * ấy hoà vốn trắng. Phân biệt này đi suốt lên tới contract
 * (`grossMarginPct: z.number().nullable()`) và tới cái dấu gạch in trên màn
 * hình.
 */
export function grossMarginPct(
  grossProfit: Prisma.Decimal,
  revenue: Prisma.Decimal,
): number | null {
  if (revenue.isZero()) return null;

  return grossProfit.div(revenue).toNumber();
}
