import { describe, expect, it } from 'vitest';
import { resolveApiOrigin } from './env';

// ADR-0026 AMEND 3 §D — API_URL sai trên Vercel = mọi request server-side
// admin forward cookie phiên sang origin đó (exfiltrate cookie admin), nên:
// parse bằng new URL() + production ép https. AMEND 4 (vòng vá review W3):
// tách phía như web, production thiếu biến throw nêu tên biến.
describe('resolveApiOrigin (admin)', () => {
  it('server: ưu tiên API_URL, fallback NEXT_PUBLIC_API_URL, trả origin trần', () => {
    expect(
      resolveApiOrigin({
        side: 'server',
        env: { API_URL: 'https://api.test/', NEXT_PUBLIC_API_URL: 'https://pub.test' },
        nodeEnv: 'production',
      }),
    ).toBe('https://api.test');
    expect(
      resolveApiOrigin({
        side: 'server',
        env: { NEXT_PUBLIC_API_URL: 'https://pub.test' },
        nodeEnv: 'production',
      }),
    ).toBe('https://pub.test');
  });

  it('browser: CHỈ NEXT_PUBLIC_API_URL — API_URL bị bỏ qua kể cả khi có', () => {
    expect(
      resolveApiOrigin({
        side: 'browser',
        env: { API_URL: 'https://internal.test', NEXT_PUBLIC_API_URL: 'https://pub.test' },
        nodeEnv: 'production',
      }),
    ).toBe('https://pub.test');
  });

  it('bỏ path thừa: "https://host/api" → "https://host" (giá trị này vào connect-src)', () => {
    expect(
      resolveApiOrigin({
        side: 'browser',
        env: { NEXT_PUBLIC_API_URL: 'https://api.test/api' },
        nodeEnv: 'production',
      }),
    ).toBe('https://api.test');
  });

  it('dev: http qua được, thiếu env rơi về localhost:3001', () => {
    expect(
      resolveApiOrigin({
        side: 'server',
        env: { API_URL: 'http://localhost:3001' },
        nodeEnv: 'development',
      }),
    ).toBe('http://localhost:3001');
    expect(resolveApiOrigin({ side: 'browser', env: {}, nodeEnv: 'development' })).toBe(
      'http://localhost:3001',
    );
  });

  it('production thiếu biến → throw NÊU TÊN BIẾN theo phía (không che bằng câu "must use https")', () => {
    expect(() => resolveApiOrigin({ side: 'server', env: {}, nodeEnv: 'production' })).toThrow(
      /Missing API origin: set API_URL\/NEXT_PUBLIC_API_URL/,
    );
    expect(() =>
      resolveApiOrigin({
        side: 'browser',
        env: { API_URL: 'https://internal.test' },
        nodeEnv: 'production',
      }),
    ).toThrow(/Missing API origin: set NEXT_PUBLIC_API_URL/);
  });

  it('production: http tới host THẬT → throw; http tới loopback vẫn qua (CI/gate/next start thử tay)', () => {
    expect(() =>
      resolveApiOrigin({
        side: 'server',
        env: { API_URL: 'http://api.test' },
        nodeEnv: 'production',
      }),
    ).toThrow(/https/);
    expect(
      resolveApiOrigin({
        side: 'browser',
        env: { NEXT_PUBLIC_API_URL: 'http://localhost:3001' },
        nodeEnv: 'production',
      }),
    ).toBe('http://localhost:3001');
  });

  it('chuỗi không phải URL → throw nêu tên biến (không đợi fetch lỗi khó hiểu)', () => {
    expect(() =>
      resolveApiOrigin({
        side: 'server',
        env: { API_URL: 'rác không phải url' },
        nodeEnv: 'development',
      }),
    ).toThrow(/API_URL/);
  });

  it('chuỗi rỗng coi như không khai (nền tảng deploy gửi "" khi ô bỏ trống)', () => {
    expect(
      resolveApiOrigin({
        side: 'server',
        env: { API_URL: '', NEXT_PUBLIC_API_URL: '' },
        nodeEnv: 'development',
      }),
    ).toBe('http://localhost:3001');
  });
});
