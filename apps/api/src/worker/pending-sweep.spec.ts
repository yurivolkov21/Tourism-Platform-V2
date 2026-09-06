import { PAYPAL_SESSION_EXPIRY_SECONDS } from '../modules/payments/paypal.gateway.js';
import { SESSION_EXPIRY_SECONDS } from '../modules/payments/stripe.gateway.js';
import { PENDING_HARD_TTL_HOURS, PENDING_TTL_MINUTES } from './pending-sweep.service.js';

// Unit — khoá bất biến TTL sweep (logic thuần, không đụng DB; hành vi hủy có
// int.spec.ts riêng). I1 (final review, money-path): TTL sweep từng đứng yên
// ở 30' trong khi hạn Stripe Checkout được nâng lên 60' (43d7a2b) — cửa sổ
// 30-60' khiến sweep hủy booking trong lúc session bên ngoài vẫn còn sống.

describe('PENDING_TTL_MINUTES bất biến', () => {
  it('TTL mềm phải lớn hơn hạn session Stripe (session hết là sweep được ngay)', () => {
    // Đổi hạn session ở gateway nào thì PHẢI xem lại PENDING_TTL_MINUTES —
    // assert này bắt drift đó ngay ở unit level, không phải đợi smoke phát hiện.
    expect(PENDING_TTL_MINUTES * 60).toBeGreaterThan(SESSION_EXPIRY_SECONDS);
  });

  it('PayPal khai hạn DÀI HƠN TTL mềm — cố ý, và trần cứng phải phủ cả nó (AMEND 2d)', () => {
    // Bản AMEND 1 từng khai "TTL sweep > hạn session dài nhất của mọi gateway"
    // trong khi PayPal 3h > 65′ — câu đó sai, và spec cũ chỉ so Stripe nên
    // không bắt được. Nay nói thật: PENDING PayPal sống tới hạn session
    // (sweep AND theo hạn), còn trần cứng mới là "dài nhất của mọi gateway".
    expect(PAYPAL_SESSION_EXPIRY_SECONDS).toBeGreaterThan(PENDING_TTL_MINUTES * 60);
    expect(PENDING_HARD_TTL_HOURS * 3600).toBeGreaterThan(PAYPAL_SESSION_EXPIRY_SECONDS);
    expect(PENDING_HARD_TTL_HOURS * 3600).toBeGreaterThan(SESSION_EXPIRY_SECONDS);
  });
});
