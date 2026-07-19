import { makeUnsubscribeToken, verifyUnsubscribeToken } from './unsubscribe-token.js';

// Logic thuần — không đụng DB, không đụng HTTP. TDD trước khi có
// unsubscribe-token.ts (spec §6: "sinh/verify HMAC token" nằm trong danh sách
// unit bắt buộc viết TRƯỚC).
describe('unsubscribe token', () => {
  const secret = 'test-secret';
  const id = '01920000-0000-7000-8000-000000000001';

  it('token sinh ra verify được', () => {
    expect(verifyUnsubscribeToken(id, makeUnsubscribeToken(id, secret), secret)).toBe(true);
  });

  it('token của subscriber KHÁC không dùng được', () => {
    const other = '01920000-0000-7000-8000-000000000002';
    expect(verifyUnsubscribeToken(id, makeUnsubscribeToken(other, secret), secret)).toBe(false);
  });

  it('secret khác → không verify được', () => {
    expect(verifyUnsubscribeToken(id, makeUnsubscribeToken(id, 'other'), secret)).toBe(false);
  });

  it('token rác không làm hàm ném lỗi', () => {
    expect(verifyUnsubscribeToken(id, 'không-phải-hex', secret)).toBe(false);
    expect(verifyUnsubscribeToken(id, '', secret)).toBe(false);
  });
});
