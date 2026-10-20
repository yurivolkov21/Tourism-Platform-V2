import { describe, expect, it } from 'vitest';
import { safeRedirect, withRedirect } from './safe-redirect';

describe('safeRedirect', () => {
  it('giữ nguyên path local hợp lệ có query string', () => {
    expect(safeRedirect('/tours?x=1')).toBe('/tours?x=1');
  });

  it('chặn protocol-relative URL (//evil.example) — về fallback mặc định', () => {
    expect(safeRedirect('//evil.example')).toBe('/');
  });

  it('chặn URL tuyệt đối (https://evil.example)', () => {
    expect(safeRedirect('https://evil.example')).toBe('/');
  });

  it('chặn scheme javascript:', () => {
    expect(safeRedirect('javascript:alert(1)')).toBe('/');
  });

  it('chặn path chứa backslash', () => {
    expect(safeRedirect('/tours\\evil')).toBe('/');
  });

  it('chặn ký tự điều khiển — dựng bằng String.fromCharCode(10), không dán ký tự thật vào source', () => {
    const withControlChar = ['/tours', String.fromCharCode(10), 'evil'].join('');
    expect(safeRedirect(withControlChar)).toBe('/');
  });

  it('chặn chuỗi rỗng', () => {
    expect(safeRedirect('')).toBe('/');
  });

  it('chặn giá trị không phải string', () => {
    expect(safeRedirect(undefined)).toBe('/');
    expect(safeRedirect(null)).toBe('/');
    expect(safeRedirect(123)).toBe('/');
    expect(safeRedirect({ path: '/tours' })).toBe('/');
  });

  it('chặn chuỗi dài hơn 512 ký tự', () => {
    const long = `/${'a'.repeat(512)}`;
    expect(safeRedirect(long)).toBe('/');
  });

  it('dùng fallback tùy biến khi truyền vào', () => {
    expect(safeRedirect('//evil.example', '/dashboard')).toBe('/dashboard');
  });
});

describe('withRedirect', () => {
  it('nối đích đã lọc vào path, có mã hoá', () => {
    expect(withRedirect('/register', '/tours/ha-long/book?date=2026-11-02')).toBe(
      '/register?redirect=%2Ftours%2Fha-long%2Fbook%3Fdate%3D2026-11-02',
    );
  });

  it('path đã có query → nối bằng &', () => {
    expect(withRedirect('/verify-email?email=a%40b.c', '/account')).toBe(
      '/verify-email?email=a%40b.c&redirect=%2Faccount',
    );
  });

  it('không có đích, đích là / hoặc đích không an toàn → giữ path trần', () => {
    expect(withRedirect('/login', null)).toBe('/login');
    expect(withRedirect('/login', '/')).toBe('/login');
    expect(withRedirect('/login', '//evil.example')).toBe('/login');
  });
});
