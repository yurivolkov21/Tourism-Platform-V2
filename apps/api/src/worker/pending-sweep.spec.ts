import { SESSION_EXPIRY_SECONDS } from '../modules/payments/stripe.gateway.js';
import { PENDING_TTL_MINUTES } from './pending-sweep.service.js';

// Unit — khoá bất biến TTL sweep (logic thuần, không đụng DB; hành vi hủy có
// int.spec.ts riêng). I1 (final review, money-path): TTL sweep từng đứng yên
// ở 30' trong khi hạn Stripe Checkout được nâng lên 60' (43d7a2b) — cửa sổ
// 30-60' khiến sweep hủy booking trong lúc session bên ngoài vẫn còn sống.

describe('PENDING_TTL_MINUTES bất biến', () => {
  it('phải lớn hơn hạn session của MỌI gateway (hiện tại: Stripe)', () => {
    // Đổi hạn session ở gateway nào thì PHẢI xem lại PENDING_TTL_MINUTES —
    // assert này bắt drift đó ngay ở unit level, không phải đợi smoke phát hiện.
    expect(PENDING_TTL_MINUTES * 60).toBeGreaterThan(SESSION_EXPIRY_SECONDS);
  });
});
