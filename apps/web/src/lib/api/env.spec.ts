import { describe, expect, it } from 'vitest';
import { resolveApiOrigin } from './env';

// ADR-0016 AMEND 1 §6 — origin API theo PHÍA: API_URL chỉ có nghĩa phía
// server (browser bundle không bao giờ thấy nó), production thiếu giá trị
// phải THROW nêu tên biến chứ không rơi về localhost câm (audit cụm 7: mọi
// nút ghi từ browser từng bắn về localhost:3001 trên prod).
describe('resolveApiOrigin', () => {
  it('server: ưu tiên API_URL trước NEXT_PUBLIC_API_URL', () => {
    expect(
      resolveApiOrigin({
        side: 'server',
        env: { API_URL: 'http://api:3001', NEXT_PUBLIC_API_URL: 'http://pub:3001' },
        nodeEnv: 'production',
      }),
    ).toBe('http://api:3001');
  });

  it('browser: CHỈ NEXT_PUBLIC_API_URL — API_URL bị bỏ qua kể cả khi có', () => {
    expect(
      resolveApiOrigin({
        side: 'browser',
        env: { API_URL: 'http://api:3001', NEXT_PUBLIC_API_URL: 'http://pub:3001' },
        nodeEnv: 'production',
      }),
    ).toBe('http://pub:3001');
  });

  it('cả hai phía: fallback NEXT_PUBLIC_API_URL rồi localhost khi KHÔNG production', () => {
    expect(
      resolveApiOrigin({
        side: 'server',
        env: { NEXT_PUBLIC_API_URL: 'http://pub:3001' },
        nodeEnv: 'development',
      }),
    ).toBe('http://pub:3001');
    expect(resolveApiOrigin({ side: 'server', env: {}, nodeEnv: 'development' })).toBe(
      'http://localhost:3001',
    );
    expect(resolveApiOrigin({ side: 'browser', env: {}, nodeEnv: 'test' })).toBe(
      'http://localhost:3001',
    );
  });

  it('production thiếu giá trị → throw, message nêu tên biến theo phía', () => {
    expect(() => resolveApiOrigin({ side: 'server', env: {}, nodeEnv: 'production' })).toThrow(
      /API_URL/,
    );
    expect(() =>
      resolveApiOrigin({
        side: 'browser',
        env: { API_URL: 'http://api:3001' },
        nodeEnv: 'production',
      }),
    ).toThrow(/NEXT_PUBLIC_API_URL/);
  });

  it('chuỗi rỗng coi như không khai (nền tảng deploy gửi "" khi ô bỏ trống)', () => {
    expect(
      resolveApiOrigin({
        side: 'server',
        env: { API_URL: '', NEXT_PUBLIC_API_URL: '' },
        nodeEnv: 'development',
      }),
    ).toBe('http://localhost:3001');
    expect(() =>
      resolveApiOrigin({
        side: 'browser',
        env: { NEXT_PUBLIC_API_URL: '' },
        nodeEnv: 'production',
      }),
    ).toThrow(/NEXT_PUBLIC_API_URL/);
  });

  it('cắt dấu / cuối để ghép path không thành //', () => {
    expect(
      resolveApiOrigin({
        side: 'server',
        env: { API_URL: 'http://api:3001/' },
        nodeEnv: 'development',
      }),
    ).toBe('http://api:3001');
  });
});
