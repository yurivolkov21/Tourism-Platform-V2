import { REFUND_POLICY_TIERS } from '@tourism/contract';

/**
 * Bậc hoàn tiền → câu chữ cho khách đọc (ADR-0030 §6).
 *
 * Cả `/cancellation-policy` lẫn `/terms` gọi hàm ở đây thay vì gõ tay lại bốn
 * mốc. Trước ADR-0030 hai văn bản chép tay cùng một bảng, và đúng thứ phải xảy
 * ra đã xảy ra: **cả hai cùng bỏ rơi ngày 14** (viết "15–29 ngày" rồi "dưới 14
 * ngày"), và công cụ admin thì không đọc được bậc nào cả.
 *
 * Hướng phụ thuộc `i18n → contract` là cố ý: bảng bậc vừa là copy vừa là LUẬT
 * TIỀN, nên nó ở contract để server đọc mà không phải import một gói copy; i18n
 * chỉ lo dịch nó thành câu. Contract không import ngược lại — không có chu
 * trình.
 */

/** `[30, 100]` → `'30 or more days before departure'`. */
function rangeLabel(minDays: number, maxDays: number | null): string {
  if (maxDays === null) return `${minDays} or more days before departure`;
  if (minDays === 0) return `Fewer than ${maxDays + 1} days before departure`;
  return `${minDays}–${maxDays} days before departure`;
}

/** `100` → `'a full refund'`; `0` → `'no refund'`; còn lại `'a 50% refund'`. */
function amountLabel(percent: number): string {
  if (percent === 100) return 'a full refund';
  if (percent === 0) return 'no refund';
  return `a ${percent}% refund`;
}

/**
 * Bốn gạch đầu dòng của bảng bậc, sinh từ chính hằng contract.
 *
 * Biên TRÊN của mỗi bậc suy từ biên DƯỚI của bậc liền trước, trừ một — nên hai
 * bậc liền nhau luôn KHÍT, và cái lỗ ngày 14 không thể tái sinh bằng cách gõ
 * tay lệch một con số.
 */
export function refundTierBullets(): string[] {
  return REFUND_POLICY_TIERS.map((tier, index) => {
    const previous = REFUND_POLICY_TIERS[index - 1];
    const maxDays = previous ? previous.minDaysBefore - 1 : null;
    return `${rangeLabel(tier.minDaysBefore, maxDays)}: ${amountLabel(tier.percent)}.`;
  });
}

/**
 * Cùng bảng ấy gói thành MỘT câu, cho `/terms` — nơi chính sách hoàn tiền chỉ
 * là một đoạn trong tài liệu dài, không phải chương riêng.
 */
export function refundTierSentence(): string {
  const parts = REFUND_POLICY_TIERS.map((tier, index) => {
    const previous = REFUND_POLICY_TIERS[index - 1];
    const maxDays = previous ? previous.minDaysBefore - 1 : null;
    if (maxDays === null)
      return `${tier.minDaysBefore} or more days before departure, ${amountLabel(tier.percent)}`;
    if (tier.minDaysBefore === 0)
      return `fewer than ${maxDays + 1} days before, ${amountLabel(tier.percent)}`;
    return `${tier.minDaysBefore}–${maxDays} days before, ${amountLabel(tier.percent)}`;
  });
  return `Cancellations are refunded on this schedule: ${parts.join('; ')}.`;
}
