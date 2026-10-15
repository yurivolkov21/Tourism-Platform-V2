import { CHAT_PRICES, costUsd, DEFAULT_CHAT_MODEL, isPricedModel } from './chat-pricing.js';

/**
 * Bảng giá sống trong code (ADR-0050 §4): trần ngày đổi token thành tiền bằng
 * chính bảng này, nên một dòng sai là trần sai theo cùng tỉ lệ.
 */
describe('chat-pricing', () => {
  it('model mặc định có trong bảng giá', () => {
    expect(DEFAULT_CHAT_MODEL).toBe('claude-haiku-4-5');
    expect(isPricedModel(DEFAULT_CHAT_MODEL)).toBe(true);
  });

  it('Haiku 4.5: 1 USD mỗi triệu token vào, 5 USD mỗi triệu token ra', () => {
    expect(CHAT_PRICES['claude-haiku-4-5']).toEqual({ inputPerMTok: 1, outputPerMTok: 5 });
    expect(costUsd('claude-haiku-4-5', 1_000_000, 0)).toBeCloseTo(1, 10);
    expect(costUsd('claude-haiku-4-5', 0, 1_000_000)).toBeCloseTo(5, 10);
  });

  it('một lượt có tool điển hình khoảng 1 cent (spec §2e)', () => {
    // ~6k token vào (prompt + kết quả tool qua vài bước), ~600 token ra.
    expect(costUsd('claude-haiku-4-5', 6000, 600)).toBeCloseTo(0.009, 6);
  });

  it('model ngoài bảng không có giá — không đoán', () => {
    expect(isPricedModel('claude-haiku-9')).toBe(false);
    expect(() => costUsd('claude-haiku-9', 1, 1)).toThrow(/no price/);
  });
});
