import { cancellationWindowSentence } from '@tourism/i18n';
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
    // Vá 04/09 gỡ "48 giờ" và lời hứa đổi ngày; ADR-0041 gỡ nốt bảng bậc mà bản
    // ấy trỏ về ("the earlier you tell us, the more comes back" — bảng đó không
    // còn). Câu sinh từ `CANCELLATION_WINDOW_RULES` nên không thể trôi lệch khỏi
    // trang chính sách. KHÔNG ghi "one click, no form": hộp huỷ cần bấm mở rồi
    // bấm xác nhận, và có ô lý do (tuỳ chọn) — đúng loại hứa quá vá 04/09 đã gỡ.
    answer: `Cancel from your account in a couple of clicks — no approval to wait for, no phone queue. ${cancellationWindowSentence()} Cancel on or before that deadline and the full amount goes back to the card or PayPal account you paid with, usually within 5–10 business days. After it, the booking is no longer refundable.`,
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
