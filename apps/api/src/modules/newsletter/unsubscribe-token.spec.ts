import {
  makeNewsletterToken,
  makeUnsubscribeToken,
  RESUBSCRIBE_TOKEN_TTL_MS,
  verifyNewsletterToken,
  verifyUnsubscribeToken,
} from './unsubscribe-token.js';

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

// W4 E4 (ADR-0039 §3): token v1 có MỤC ĐÍCH + PHIÊN BẢN — một chuỗi không
// còn mở được mọi cửa. v0 (HMAC trần đã in trong email cũ) chỉ được nhận cho
// unsubscribe, tới 31/12/2026.
describe('newsletter token v1 (purpose + version)', () => {
  const secret = 'test-secret';
  const id = '01920000-0000-7000-8000-000000000001';

  it('mỗi purpose sinh token verify được với ĐÚNG purpose đó', () => {
    for (const purpose of ['unsubscribe', 'confirm', 'resubscribe'] as const) {
      const token = makeNewsletterToken(id, purpose, secret);
      expect(verifyNewsletterToken(id, token, purpose, secret)).toBe(true);
      expect(token.startsWith(`v1.${purpose}.`)).toBe(true);
    }
  });

  it('purpose SAI → false: token unsubscribe không mở được cửa confirm/resubscribe', () => {
    const unsub = makeNewsletterToken(id, 'unsubscribe', secret);
    expect(verifyNewsletterToken(id, unsub, 'confirm', secret)).toBe(false);
    expect(verifyNewsletterToken(id, unsub, 'resubscribe', secret)).toBe(false);
    const confirm = makeNewsletterToken(id, 'confirm', secret);
    expect(verifyNewsletterToken(id, confirm, 'unsubscribe', secret)).toBe(false);
  });

  it('subscriber khác / secret khác → false', () => {
    const other = '01920000-0000-7000-8000-000000000002';
    const token = makeNewsletterToken(id, 'confirm', secret);
    expect(verifyNewsletterToken(other, token, 'confirm', secret)).toBe(false);
    expect(verifyNewsletterToken(id, token, 'confirm', 'other-secret')).toBe(false);
  });

  it('resubscribe mang exp 30 ngày: còn hạn → true, quá hạn → false', () => {
    const now = new Date('2026-09-07T00:00:00.000Z');
    const token = makeNewsletterToken(id, 'resubscribe', secret, now);
    const justBefore = new Date(now.getTime() + RESUBSCRIBE_TOKEN_TTL_MS - 1000);
    const justAfter = new Date(now.getTime() + RESUBSCRIBE_TOKEN_TTL_MS + 1000);
    expect(verifyNewsletterToken(id, token, 'resubscribe', secret, justBefore)).toBe(true);
    expect(verifyNewsletterToken(id, token, 'resubscribe', secret, justAfter)).toBe(false);
  });

  it('exp bị sửa tay trong token → false (exp nằm TRONG phần ký)', () => {
    const now = new Date('2026-09-07T00:00:00.000Z');
    const token = makeNewsletterToken(id, 'resubscribe', secret, now);
    const [v, purpose, exp, hmac] = token.split('.');
    const farFuture = String(Number(exp) + 86_400 * 365);
    expect(
      verifyNewsletterToken(id, `${v}.${purpose}.${farFuture}.${hmac}`, 'resubscribe', secret, now),
    ).toBe(false);
  });

  it('unsubscribe/confirm KHÔNG hết hạn (không mang exp)', () => {
    const token = makeNewsletterToken(id, 'unsubscribe', secret, new Date('2026-01-01'));
    expect(verifyNewsletterToken(id, token, 'unsubscribe', secret, new Date('2036-01-01'))).toBe(
      true,
    );
  });

  it('v0 (HMAC trần) CHỈ được nhận cho unsubscribe — email cũ còn chạy tới 31/12/2026', () => {
    const v0 = makeUnsubscribeToken(id, secret);
    expect(verifyNewsletterToken(id, v0, 'unsubscribe', secret)).toBe(true);
    expect(verifyNewsletterToken(id, v0, 'confirm', secret)).toBe(false);
    expect(verifyNewsletterToken(id, v0, 'resubscribe', secret)).toBe(false);
  });

  it('token rác/rỗng/version lạ không ném lỗi, chỉ false', () => {
    expect(verifyNewsletterToken(id, '', 'unsubscribe', secret)).toBe(false);
    expect(verifyNewsletterToken(id, 'v2.unsubscribe.abc', 'unsubscribe', secret)).toBe(false);
    expect(verifyNewsletterToken(id, 'v1.unsubscribe', 'unsubscribe', secret)).toBe(false);
    expect(verifyNewsletterToken(id, 'v1..deadbeef', 'unsubscribe', secret)).toBe(false);
    expect(verifyNewsletterToken(id, 'v1.resubscribe.NaN.deadbeef', 'resubscribe', secret)).toBe(
      false,
    );
  });
});
