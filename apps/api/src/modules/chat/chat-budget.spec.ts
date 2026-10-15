import { isOverDailyBudget, utcDayStart } from './chat-budget.js';

describe('utcDayStart', () => {
  it('về 00:00 UTC của cùng ngày UTC', () => {
    expect(utcDayStart(new Date('2026-10-15T23:59:59.999Z')).toISOString()).toBe(
      '2026-10-15T00:00:00.000Z',
    );
  });

  it('theo UTC chứ không theo giờ Việt Nam — 06:30 sáng VN vẫn là ngày UTC hôm trước', () => {
    // 2026-10-15 06:30 giờ VN = 2026-10-14 23:30 UTC.
    expect(utcDayStart(new Date('2026-10-14T23:30:00Z')).toISOString()).toBe(
      '2026-10-14T00:00:00.000Z',
    );
  });
});

describe('isOverDailyBudget', () => {
  const model = 'claude-haiku-4-5';

  it('dưới trần thì cho qua', () => {
    // 0,999 USD: 999_000 token vào.
    expect(isOverDailyBudget({ inputTokens: 999_000, outputTokens: 0 }, model, 1)).toBe(false);
  });

  it('đúng bằng trần là chặn', () => {
    expect(isOverDailyBudget({ inputTokens: 500_000, outputTokens: 100_000 }, model, 1)).toBe(true);
  });

  it('token ra đắt gấp năm token vào', () => {
    expect(isOverDailyBudget({ inputTokens: 0, outputTokens: 199_000 }, model, 1)).toBe(false);
    expect(isOverDailyBudget({ inputTokens: 0, outputTokens: 200_000 }, model, 1)).toBe(true);
  });

  it('chưa tiêu gì thì không bao giờ chạm trần dương', () => {
    expect(isOverDailyBudget({ inputTokens: 0, outputTokens: 0 }, model, 0.1)).toBe(false);
  });
});
