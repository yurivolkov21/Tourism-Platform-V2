import { describe, expect, it } from 'vitest';
import { resolveApiOrigin } from './env';

// ADR-0026 AMEND 3 §D — API_URL sai trên Vercel = mọi request server-side
// admin forward cookie phiên sang origin đó (exfiltrate cookie admin), nên:
// parse bằng new URL() (chuỗi rác chết ngay lúc boot) + production ép https.
describe('resolveApiOrigin (admin)', () => {
  it('ưu tiên API_URL, fallback NEXT_PUBLIC_API_URL, trả origin trần', () => {
    expect(
      resolveApiOrigin({
        env: { API_URL: 'https://api.test/', NEXT_PUBLIC_API_URL: 'https://pub.test' },
        nodeEnv: 'production',
      }),
    ).toBe('https://api.test');
    expect(
      resolveApiOrigin({ env: { NEXT_PUBLIC_API_URL: 'https://pub.test' }, nodeEnv: 'production' }),
    ).toBe('https://pub.test');
  });

  it('dev: http qua được, thiếu env rơi về localhost:3001', () => {
    expect(
      resolveApiOrigin({ env: { API_URL: 'http://localhost:3001' }, nodeEnv: 'development' }),
    ).toBe('http://localhost:3001');
    expect(resolveApiOrigin({ env: {}, nodeEnv: 'development' })).toBe('http://localhost:3001');
  });

  it('production: scheme khác https → throw (kể cả fallback localhost khi quên env)', () => {
    expect(() =>
      resolveApiOrigin({ env: { API_URL: 'http://api.test' }, nodeEnv: 'production' }),
    ).toThrow(/https/);
    expect(() => resolveApiOrigin({ env: {}, nodeEnv: 'production' })).toThrow(/https/);
  });

  it('chuỗi không phải URL → throw ngay (không đợi fetch lỗi khó hiểu)', () => {
    expect(() =>
      resolveApiOrigin({ env: { API_URL: 'rác không phải url' }, nodeEnv: 'development' }),
    ).toThrow();
  });

  it('chuỗi rỗng coi như không khai (nền tảng deploy gửi "" khi ô bỏ trống)', () => {
    expect(
      resolveApiOrigin({ env: { API_URL: '', NEXT_PUBLIC_API_URL: '' }, nodeEnv: 'development' }),
    ).toBe('http://localhost:3001');
  });
});
