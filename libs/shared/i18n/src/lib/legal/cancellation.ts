import type { LegalDoc } from './legal-page.js';
import { refundTierBullets } from './refund-tiers.js';

/**
 * Cancellation & Refund Policy — mô tả đúng luồng hoàn tiền thật: khách gửi
 * yêu cầu huỷ, đội ngũ xem xét rồi liên hệ lại, sau đó hoàn về đúng phương
 * thức đã thanh toán.
 *
 * Từ ADR-0030 các mốc là **CƯỠNG CHẾ, không phải hướng dẫn**: hệ thống tính số
 * tiền từ chính bảng bậc ở `@tourism/contract` và khoá nó trên màn hình admin.
 * Nên hai câu của bản cũ đã bị bỏ:
 *
 * - *"general guidelines rather than fixed rules"* — máy đã quyết thì đừng bảo
 *   khách rằng đó là gợi ý.
 * - *"less any non-recoverable supplier costs"* — điều khoản BẤT KHẢ THI HÀNH:
 *   hệ thống không biết chi phí nhà cung cấp, nên câu ấy chỉ làm con số công bố
 *   mập mờ mà không ai trừ được thật.
 *
 * Gạch đầu dòng bậc KHÔNG gõ tay — `refundTierBullets()` sinh từ hằng. Bản gõ
 * tay cũ đã bỏ rơi đúng ngày 14 ("15–29" rồi "dưới 14").
 */
export const cancellationDoc: LegalDoc = {
  title: 'Cancellation & Refund Policy',
  breadcrumb: 'Cancellation & Refund Policy',
  updated: 'Last updated: 25 July 2026',
  reviewNote:
    'This document is sample content for a student capstone project, not legal advice. Nexora does not sell real trips here: payments run entirely in Stripe and PayPal test/sandbox mode, and no money changes hands.',
  intro: [
    'We want you to book with confidence. This policy explains how to cancel a booking, what to expect, and how refunds are handled. It applies alongside our Terms & Conditions and any cancellation terms shown on the specific tour you booked.',
    'Plans change — if you need to cancel, get in touch as early as you can. The sooner you tell us, the more you get back.',
    'Because this site runs payments in test/sandbox mode, every refund described below is simulated: nothing was charged, so nothing is returned to a real account.',
  ],
  sections: [
    {
      heading: 'How to request a cancellation',
      paragraphs: [
        'You can request a cancellation at any time from your account: open the booking under “My bookings” and choose “Request cancellation”, or contact our team directly using the details in the site footer.',
        'A cancellation request does not cancel the booking automatically. Our team reviews each request and contacts you — normally within about 2 business days — to confirm the details and arrange your refund. We handle every request personally so we can take your circumstances into account.',
      ],
    },
    {
      heading: 'Refund schedule',
      paragraphs: [
        'How much you get back depends on how far in advance you cancel. The schedule below is fixed — we apply it to every cancellation, so you can work out your refund before you ask for one.',
        'Some tours are more generous than this: where a tour advertises free cancellation up to a certain number of days before departure, that promise applies instead and you receive a full refund up to that deadline. A tour-specific promise can only ever improve on the schedule below, never reduce it.',
      ],
      bullets: [
        ...refundTierBullets(),
        'No-shows, and cancellations made after the tour has started, are not refundable.',
      ],
    },
    {
      heading: 'Changed your mind? The first 24 hours are free',
      paragraphs: [
        'If you cancel within 24 hours of paying, you get a full refund — whatever the schedule above would otherwise say, and however close your departure is.',
        'This exists because the schedule measures one thing only: how close your departure is, which is what determines the costs we have already committed to guides, hotels and transport. It does not measure how long you have held the booking — and someone who books and changes their mind the same evening has cost us nothing. Without this window, booking a tour that leaves in two weeks would mean you could never get a full refund, no matter how quickly you told us.',
      ],
    },
    {
      heading: 'How we count the days',
      paragraphs: [
        'We count whole calendar days between the date you send your cancellation request and your departure date. The time of day does not matter — a request sent late in the evening counts the same as one sent that morning.',
        'What matters is when you tell us, not when we get round to processing it. If our team takes a few days to review your request, you keep the refund band that applied on the day you asked.',
      ],
    },
    {
      heading: 'How refunds are processed',
      paragraphs: [
        'Approved refunds are returned to your original payment method (the card or PayPal account used at checkout). We are not able to refund to a different method.',
        'Once a refund is agreed, it is typically issued within about 5–10 business days, though the time for it to appear on your statement depends on your bank or card provider. Refunds are made in the currency of your original payment.',
      ],
    },
    {
      heading: 'Deposits and non-refundable amounts',
      paragraphs: [
        'Where a tour requires a deposit, that deposit may be non-refundable, as it secures supplier reservations on your behalf. Third-party charges (such as payment-processing fees, visa fees, or pre-purchased tickets) may also be non-refundable. Any such amounts will be made clear before you book wherever possible.',
      ],
    },
    {
      heading: 'Unpaid (pending) bookings',
      paragraphs: [
        'If you start a booking but do not complete payment, no charge is taken and nothing is owed. Unpaid bookings are released automatically after a short time, so there is no need to cancel them — though you can do so from your account at any time.',
      ],
    },
    {
      heading: 'Changing your booking',
      paragraphs: [
        'If you would like to change your travel dates or details rather than cancel, contact us as early as possible. Changes are subject to availability and any difference in price, and may be treated as a cancellation and re-booking depending on the tour and timing.',
      ],
    },
    {
      heading: 'If we cancel, or in the event of force majeure',
      paragraphs: [
        'If we cancel a confirmed tour for reasons within our control, you will be offered a full refund or the option to reschedule. Where a tour cannot run due to events beyond reasonable control (for example severe weather, natural events, strikes, or government restrictions), we will work with you on a refund or reschedule based on what we can recover from suppliers. We are not responsible for incidental costs such as flights, visas, or insurance, so we recommend appropriate travel insurance.',
      ],
    },
  ],
};
