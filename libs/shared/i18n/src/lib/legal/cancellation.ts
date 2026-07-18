import type { LegalDoc } from './legal-page.js';

/**
 * Cancellation & Refund Policy — describes the platform's actual refund flow: the customer sends a
 * cancellation request, our team reviews and contacts them, then processes a refund manually to the
 * original payment method. Timeframe tiers are written as **guidelines** (not an automated engine),
 * since refunds are handled case by case. Bracketed values are placeholders pending legal review.
 */
export const cancellationDoc: LegalDoc = {
  title: 'Cancellation & Refund Policy',
  breadcrumb: 'Cancellation & Refund Policy',
  updated: 'Last updated: 29 June 2026',
  intro: [
    'We want you to book with confidence. This policy explains how to cancel a booking, what to expect, and how refunds are handled. It applies alongside our Terms & Conditions and any cancellation terms shown on the specific tour you booked.',
    'Plans change — if you need to cancel, get in touch as early as you can. The sooner you tell us, the more we are usually able to refund.',
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
      heading: 'Refund guidelines',
      paragraphs: [
        'Because we review cancellations individually, the amounts below are general guidelines rather than fixed rules. The final refund depends on the specific tour, how far in advance you cancel, and any costs already committed to local suppliers (guides, hotels, cruises, transport). Some tours carry their own cancellation terms, shown on the tour page — where they differ, the tour-specific terms apply.',
      ],
      bullets: [
        '30 or more days before departure: full refund, less any non-recoverable supplier costs.',
        '15–29 days before departure: partial refund (as a guide, around 50%).',
        'Fewer than 14 days before departure: generally non-refundable, as costs are usually already committed.',
        'No-shows or cancellations after the tour has started are not refundable.',
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
