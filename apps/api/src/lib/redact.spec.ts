import { REDACTED, redactDeep, SECRET_KEYS } from './redact.js';

/**
 * Máy che DÙNG CHUNG (vòng vá review F8) — outbox và payment events đi qua
 * cùng một hàm nên test luật ở đây một lần; spec mapper từng vùng chỉ còn
 * kiểm "đã đi qua máy che".
 */
describe('redactDeep', () => {
  it('che theo TÊN khoá ở mọi độ sâu, kể cả trong mảng; khoá không bí mật cùng tiền tố giữ nguyên', () => {
    expect(
      redactDeep({
        links: [{ href: 'https://api.paypal.com/x', access_token: 'abc' }],
        nested: { deeper: { api_key: 'k', password: 'p', token: 't', note: 'keep' } },
        // `secret` là chuỗi con của tên nhưng KHÔNG phải khoá bí mật — không che.
        secret_reason: 'visible',
      }),
    ).toEqual({
      links: [{ href: 'https://api.paypal.com/x', access_token: REDACTED }],
      nested: { deeper: { api_key: REDACTED, password: REDACTED, token: REDACTED, note: 'keep' } },
      secret_reason: 'visible',
    });
  });

  it('tập khoá là HỢP của outbox (url/otp/token) và payment events (client_secret…)', () => {
    for (const key of ['url', 'otp', 'token', 'client_secret', 'access_token', 'password']) {
      expect(SECRET_KEYS.has(key)).toBe(true);
    }
    expect(redactDeep({ url: 'https://x/reset?token=t', otp: '482913', code: 'BK-1' })).toEqual({
      url: REDACTED,
      otp: REDACTED,
      code: 'BK-1',
    });
  });

  it('vô hướng/null/mảng ngoài cùng đi qua nguyên vẹn; input không bị sửa tại chỗ', () => {
    expect(redactDeep('plain')).toBe('plain');
    expect(redactDeep(null)).toBeNull();
    expect(redactDeep(7)).toBe(7);
    expect(redactDeep([1, { token: 'x' }])).toEqual([1, { token: REDACTED }]);
    const input = { token: 'x', child: { otp: '1' } };
    redactDeep(input);
    expect(input).toEqual({ token: 'x', child: { otp: '1' } });
  });

  it('khoá `__proto__` trong JSON bên ngoài là DỮ LIỆU, không thành prototype của object dựng ra', () => {
    const out = redactDeep(JSON.parse('{"__proto__":{"polluted":true},"token":"t"}')) as Record<
      string,
      unknown
    >;
    expect(Object.getPrototypeOf(out)).toBeNull();
    expect(Object.hasOwn(out, '__proto__')).toBe(true);
    expect(out.token).toBe(REDACTED);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it('tập khoá tuỳ chọn thay được mặc định', () => {
    expect(redactDeep({ token: 't', custom: 'c' }, new Set(['custom']))).toEqual({
      token: 't',
      custom: REDACTED,
    });
  });
});
