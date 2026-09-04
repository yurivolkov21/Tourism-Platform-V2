import {
  daysBeforeDeparture,
  isWithinGracePeriod,
  refundPercentForDays,
  refundPercentForRequest,
} from '@tourism/contract';
import { percentOfAmount, remainingRefundable } from './refund';

/**
 * Logic THUẦN của bước "hoàn bao nhiêu" trong stepper approve (ADR-0029 §5 +
 * ADR-0030) — đứng ngoài React và có test riêng, đúng khuôn `refund.ts` và
 * `cancellations-decide.ts`.
 *
 * Nguyên tắc: file này KHÔNG có bảng bậc nào của riêng nó. Phần trăm do
 * `refundPercentForRequest` của contract quyết — ĐÚNG hàm mà dialog xin huỷ
 * bên `apps/web` gọi — nên con số khách nhìn thấy lúc gửi yêu cầu và con số
 * admin nhìn thấy lúc duyệt không thể lệch nhau. Ở đây chỉ còn hai việc: đổi
 * phần trăm thành tiền, và kể ra CĂN CỨ để admin đọc được vì sao là con số đó.
 */

/** Mọi thứ cần để tính mức hoàn theo chính sách cho MỘT yêu cầu huỷ. */
export interface ApproveRefundContext {
  /**
   * Lúc KHÁCH gửi yêu cầu (`CancellationRequest.createdAt`), KHÔNG phải lúc
   * admin mở dialog (ADR-0030 §4): xử chậm là lỗi của ta, không được làm khách
   * rớt bậc.
   */
  requestedAt: string;
  /** ISO; `null` = chưa trả tiền, nên không có ân hạn. */
  paidAt: string | null;
  departureStartDate: string;
  /** Badge của tour — NÂNG ngưỡng 100%, không bao giờ hạ (ADR-0030 §3). */
  freeCancellationDays: number | null;
  totalAmount: string;
  refundedTotal: string;
}

/** Mức hoàn theo chính sách, kèm căn cứ sinh ra nó. */
export interface PolicyRefund {
  percent: number;
  /** Tiền sẽ hoàn: `percent`% của TỔNG, trừ phần đã hoàn, kẹp trong phần dư. */
  amount: string;
  /** Trần tuyệt đối = total − đã hoàn. Cũng là trần validate của đường vượt bậc. */
  remaining: string;
  /** Số ngày lịch từ lúc GỬI yêu cầu tới ngày khởi hành; âm = đã khởi hành. */
  days: number;
  /** Yêu cầu nằm trong 24 giờ sau thanh toán → 100% bất kể còn mấy ngày. */
  inGrace: boolean;
  /** Badge của tour ĐANG là thứ nâng mức hoàn lên trên bậc chung của site. */
  badgeApplied: boolean;
}

/**
 * Mức hoàn theo chính sách cho một yêu cầu huỷ.
 *
 * Hai phép trừ, theo đúng thứ tự này (ADR-0030 §7):
 *
 * 1. phần trăm áp lên **TỔNG** booking, không phải lên phần dư — bậc nói "hoàn
 *    50% số tiền khách đã trả", và tính trên phần dư sẽ ra con số khác hẳn ở
 *    booking từng hoàn thiện chí một ít;
 * 2. rồi mới **trừ phần đã hoàn**, vì khoản ấy khách cầm rồi.
 *
 * Kẹp vào `remaining` là lưới cuối cho ca badge/ân hạn đẩy phần trăm lên 100
 * trên một booking đã hoàn dư so với bậc: kết quả âm thành 0, và 0 là hợp lệ —
 * approve chịu được phần dư bằng 0 (ADR-0029 §2).
 */
export function policyRefund(context: ApproveRefundContext): PolicyRefund {
  const requestedAt = new Date(context.requestedAt);
  const days = daysBeforeDeparture(requestedAt, context.departureStartDate);
  const percent = refundPercentForRequest({
    requestedAt,
    paidAt: context.paidAt,
    departureStartDate: context.departureStartDate,
    freeCancellationDays: context.freeCancellationDays,
  });
  const inGrace = isWithinGracePeriod(context.paidAt, requestedAt);
  const remaining = remainingRefundable(context.totalAmount, context.refundedTotal);
  const gross = percentOfAmount(context.totalAmount, percent);

  return {
    percent,
    // `remainingRefundable` đã kẹp sàn 0, nên gọi nó hai lần là vừa trừ vừa kẹp.
    amount: minAmount(remainingRefundable(gross, context.refundedTotal), remaining),
    remaining,
    days,
    inGrace,
    // Chỉ kể badge khi nó THẬT SỰ là thứ tạo ra con số: trong ân hạn thì 100%
    // đến từ ân hạn, và nói badge lúc ấy là kể sai căn cứ.
    badgeApplied:
      !inGrace &&
      context.freeCancellationDays !== null &&
      days >= context.freeCancellationDays &&
      refundPercentForDays(days) < 100,
  };
}

/** Số nhỏ hơn trong hai decimal string tiền. */
function minAmount(a: string, b: string): string {
  return Number(a) <= Number(b) ? a : b;
}
