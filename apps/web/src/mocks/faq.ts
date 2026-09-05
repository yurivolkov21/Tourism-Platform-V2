import { REFUND_GRACE_HOURS } from '@tourism/contract';
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
    // Vá 04/09 — câu cũ hứa HAI thứ site không làm được: hoàn 100% ở mốc 48
    // giờ (chính sách nói dưới 7 ngày là 0%) và "rebook you to a later date"
    // (KHÔNG có luồng đổi ngày nào tồn tại). Nay nói đúng thứ có thật, và trỏ
    // về bảng bậc thay vì nhắc lại một con số sẽ trôi lệch.
    answer: `Request it from your account and we handle it — no phone queue. How much you get back follows our published refund schedule: the earlier you tell us, the more comes back, and anything cancelled within ${REFUND_GRACE_HOURS} hours of paying is refunded in full. Want to move dates instead? Contact us and we will see what the tour allows.`,
  },
  {
    question: 'How big are the groups, really?',
    answer:
      'It depends on the route and the vehicle — every tour page shows its own cap before you book. What never changes: small enough that your guide knows your name, never a coach.',
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
