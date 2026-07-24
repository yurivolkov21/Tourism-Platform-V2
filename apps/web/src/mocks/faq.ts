import type { MockFaqItem } from './types.js';

// 5 câu FAQ pre-sales cho mini-FAQ trang Contact (rút gọn kiểu Nexora
// contact-faq — bản đầy đủ thuộc trang /faq tương lai). Ứng viên schema
// `faqs` (question · answer · category · sort_order).
export const FAQ_ITEMS: MockFaqItem[] = [
  {
    question: 'Do I pay anything before the itinerary is agreed?',
    answer:
      'No. We draft two or three routes for free, and you only pay once you approve one. Test-mode checkout, no surprises.',
  },
  {
    question: 'What if I need to cancel?',
    answer:
      'Cancel up to 48 hours before departure for a full refund — no forms, no phone queue. Inside 48 hours we rebook you to a later date instead.',
  },
  {
    question: 'How big are the groups, really?',
    answer:
      'Twelve travellers at most, on every departure, in every season. It is the one number we have never bent.',
  },
  {
    question: 'Do the guides speak English?',
    answer:
      'Every guide leads comfortably in English and Vietnamese; several also cover French or Japanese — tell us in the form and we will match you.',
  },
  {
    question: 'How do payments work?',
    answer:
      'Card or bank transfer through Stripe and PayPal (sandbox mode on this site). You get an itemized receipt before and after paying.',
  },
];
