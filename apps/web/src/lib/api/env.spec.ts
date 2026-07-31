import { describe, expect, it } from 'vitest';
import { resolveApiOrigin } from './env';

describe('resolveApiOrigin', () => {
  it('ưu tiên API_URL (server-side) trước NEXT_PUBLIC_API_URL', () => {
    expect(
      resolveApiOrigin({ API_URL: 'http://api:3001', NEXT_PUBLIC_API_URL: 'http://pub:3001' }),
    ).toBe('http://api:3001');
  });
  it('fallback NEXT_PUBLIC_API_URL rồi mới tới default localhost:3001', () => {
    expect(resolveApiOrigin({ NEXT_PUBLIC_API_URL: 'http://pub:3001' })).toBe('http://pub:3001');
    expect(resolveApiOrigin({})).toBe('http://localhost:3001');
  });
  it('chuỗi rỗng coi như không khai (nền tảng deploy gửi "" khi ô bỏ trống)', () => {
    expect(resolveApiOrigin({ API_URL: '', NEXT_PUBLIC_API_URL: '' })).toBe(
      'http://localhost:3001',
    );
  });
  it('cắt dấu / cuối để ghép path không thành //', () => {
    expect(resolveApiOrigin({ API_URL: 'http://api:3001/' })).toBe('http://api:3001');
  });
});
