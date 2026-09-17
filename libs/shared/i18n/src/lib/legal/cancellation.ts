import { CANCELLATION_WINDOW_RULES } from '@tourism/contract';
import type { LegalDoc } from './legal-page.js';

/**
 * `[1, 1]` → `'day trips'`; `[2, 3]` → `'trips of 2–3 days'`;
 * `[4, null]` → `'trips of 4 days or more'`. Viết thường vì cụm này đứng GIỮA
 * câu ở `/terms` và FAQ; chỗ cần chữ hoa thì `capitalise` lo.
 */
function tripLengthPhrase(minTripDays: number, maxTripDays: number | null): string {
  if (maxTripDays === null) return `trips of ${minTripDays} days or more`;
  if (minTripDays === maxTripDays)
    return minTripDays === 1 ? 'day trips' : `${minTripDays}-day trips`;
  return `trips of ${minTripDays}–${maxTripDays} days`;
}

/** `1` → `'1 day'`; `7` → `'7 days'` — số nhiều đúng, không "1 days". */
function dayCount(days: number): string {
  return days === 1 ? '1 day' : `${days} days`;
}

/** Viết hoa chữ cái đầu: gạch đầu dòng mở đầu bằng cụm độ dài chuyến. */
function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * Ba gạch đầu dòng của bảng hạn chót, sinh từ CHÍNH hằng contract.
 *
 * Không gõ tay, cùng lý do đã khai tử bản bậc cũ: hai văn bản từng chép tay một
 * bảng rồi cả hai cùng bỏ rơi ngày 14. Ở đây rủi ro còn lớn hơn — hạn chót vừa
 * là câu chữ cho khách đọc vừa là mốc server dùng để khoá đặt chỗ và tính tiền
 * hoàn, nên văn bản lệch hằng là văn bản nói dối.
 */
export function cancellationWindowBullets(): string[] {
  return CANCELLATION_WINDOW_RULES.map(
    (rule) =>
      `${capitalise(tripLengthPhrase(rule.minTripDays, rule.maxTripDays))}: free cancellation up to ${dayCount(rule.windowDays)} before departure.`,
  );
}

/**
 * Cùng bảng ấy gói thành MỘT câu, cho `/terms` và FAQ — nơi luật huỷ chỉ là một
 * đoạn trong tài liệu dài, không phải chương riêng.
 */
export function cancellationWindowSentence(): string {
  const parts = CANCELLATION_WINDOW_RULES.map(
    (rule) =>
      `${tripLengthPhrase(rule.minTripDays, rule.maxTripDays)}, ${dayCount(rule.windowDays)} before departure`,
  );
  return `Every tour is free to cancel until its own deadline: ${parts.join('; ')}.`;
}

/**
 * Cancellation & Refund Policy — bản ADR-0041: MỘT hạn chót mỗi chuyến, dài
 * ngắn theo độ dài chuyến, tính theo ngày lịch Việt Nam.
 *
 * Bản trước (25/07) tả một luồng không còn tồn tại và ba thứ nay đã bị gỡ:
 *
 * - **Bảng bậc 100/50/25/0** — thay bằng nhị phân "trong hạn hoàn đủ / quá hạn
 *   không hoàn". Bậc chỉ có nghĩa khi có người ngồi duyệt từng ca; khách tự huỷ
 *   ngay thì một con số phải đúng ngay lúc bấm.
 * - **Ân hạn 24 giờ** — sinh ra để vá đúng chỗ bậc làm khách thiệt (đặt hôm nay,
 *   chuyến sau hai tuần, đổi ý ngay tối đó mà vẫn mất tiền). Bỏ bậc thì ân hạn
 *   hết lý do tồn tại; giữ lại chỉ là chồng luật lên luật.
 * - **"A cancellation request does not cancel the booking automatically"** kèm
 *   hẹn "khoảng 2 ngày làm việc" — hàng đợi duyệt đã gỡ, huỷ là huỷ ngay.
 *
 * Cũng bỏ hai câu bất khả thi hành của bản cũ: lời hứa đổi ngày (KHÔNG có luồng
 * nào làm việc đó) và vế "based on what we can recover from suppliers" (hệ thống
 * không biết chi phí nhà cung cấp, nên câu ấy chỉ làm con số công bố mập mờ).
 */
export const cancellationDoc: LegalDoc = {
  title: 'Cancellation & Refund Policy',
  breadcrumb: 'Cancellation & Refund Policy',
  updated: 'Last updated: 15 September 2026',
  reviewNote:
    'This document is sample content for a student capstone project, not legal advice. Nexora does not sell real trips here: payments run entirely in Stripe and PayPal test/sandbox mode, and no money changes hands.',
  intro: [
    'One deadline per trip, and the same rule on every tour we sell. Cancel on or before it and you get everything back; cancel after it and the booking is no longer refundable. Nothing here depends on which tour you picked or on anyone reviewing your case.',
    'This policy applies alongside our Terms & Conditions. Where the two say anything about cancelling, this page is the detailed one.',
    'Because this site runs payments in test/sandbox mode, every refund described below is simulated: nothing was charged, so nothing is returned to a real account.',
  ],
  sections: [
    {
      heading: 'Your free-cancellation deadline',
      paragraphs: [
        'Every departure has one deadline, and how long the trip runs is the only thing that sets it. Longer trips need more notice because more is committed further ahead — rooms, boats, guides who turned other work down.',
        'The deadline falls at 11:59 pm Vietnam time (GMT+7) on the day shown. That clock is the only one we use: your own time zone does not move the deadline, and neither does changing the time on your device.',
        'You never have to work the date out yourself. We print it on the tour page, at checkout, in your confirmation email, and on the booking itself.',
      ],
      bullets: cancellationWindowBullets(),
    },
    {
      heading: 'When bookings close',
      paragraphs: [
        'A departure stops taking new bookings at the same moment its deadline passes. We close it there on purpose: past that point a booking could never be cancelled for a refund, and we are not willing to sell a seat on terms we would not accept ourselves.',
        'If you want to join a trip that has already closed, contact us with the departure date and party size. We will tell you honestly whether it can still be arranged.',
      ],
    },
    {
      heading: 'Cancelling your booking',
      paragraphs: [
        'Open the booking under “My bookings” in your account and choose “Cancel booking”. It is cancelled immediately — there is no request to submit, no queue, and nobody to wait for.',
        'Cancel on or before the deadline and you are refunded in full. Cancel after it, or simply not turn up on the day, and no refund is due: by then the guide, the rooms and the transport are already paid for on your behalf.',
        'You can cancel online at any time before your departure date, even once the deadline has passed — you just will not be refunded. Once the trip has started, contact us instead.',
      ],
    },
    {
      heading: 'How refunds are processed',
      paragraphs: [
        'Refunds are returned to the payment method you used at checkout (the same card or PayPal account), in the currency you paid in. We are not able to send a refund anywhere else.',
        'The refund is issued the moment you cancel. It then usually takes 5–10 business days to appear on your statement — that part is up to your bank or card provider, not to us.',
      ],
    },
    {
      heading: 'If we cancel your departure',
      paragraphs: [
        'If we cancel a departure — for any reason at all, including weather, safety, or too few travellers — you get 100% of what you paid us back, whatever your deadline said. The deadline binds you, not us.',
        'We are not responsible for costs you arranged elsewhere, such as flights, visas, or insurance, so we recommend travel insurance that covers them.',
      ],
    },
    {
      heading: 'Unpaid (pending) bookings',
      paragraphs: [
        'If you start a booking but never complete payment, nothing is charged and nothing is owed. Unpaid bookings are released automatically after a short time, and you can release one yourself from your account at any moment.',
      ],
    },
    {
      heading: 'Special circumstances',
      paragraphs: [
        'Illness, bereavement, a refused visa — life does not keep to a deadline. If something serious happened, contact us with your booking code and tell us what it was. We cannot promise an outcome, but a person will read it and decide.',
      ],
    },
  ],
};
