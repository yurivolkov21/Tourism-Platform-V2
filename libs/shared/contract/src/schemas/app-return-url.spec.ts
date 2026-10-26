import { describe, expect, it } from 'vitest';
import {
  AppReturnUrlSchema,
  isAllowedAppReturnUrl,
  withAppReturnParams,
} from './app-return-url.js';

describe('isAllowedAppReturnUrl (ADR-0062)', () => {
  it.each([
    'nexora://bookings/new/verify',
    'nexora:///bookings/new/verify',
    'exp://192.168.0.143:8082/--/bookings/new/verify',
    'exp://10.0.0.5:8081/--/bookings/new/verify',
    'exp://172.20.1.2:8081/--/x',
    'exps://localhost:8081/--/x',
    'exp://127.0.0.1:8081/--/x',
  ])('nhận %s', (url) => {
    expect(isAllowedAppReturnUrl(url)).toBe(true);
  });

  it.each([
    'https://evil.example/steal',
    'http://192.168.0.143:8082/',
    'javascript:alert(1)',
    'exp://evil.example:8081/--/x',
    'exp://8.8.8.8:8081/--/x',
    'exp://172.32.0.1:8081/--/x',
    'exp://192.168.0.143.evil.example:8081/--/x',
    'nexoraevil://x',
    'intent://x#Intent;scheme=nexora;end',
    '',
    'not a url',
  ])('từ chối %s', (url) => {
    expect(isAllowedAppReturnUrl(url)).toBe(false);
  });

  it('schema zod dùng đúng luật và giới hạn độ dài', () => {
    expect(AppReturnUrlSchema.safeParse('nexora://bookings/new/verify').success).toBe(true);
    expect(AppReturnUrlSchema.safeParse('https://evil.example').success).toBe(false);
    expect(AppReturnUrlSchema.safeParse(`nexora://${'a'.repeat(600)}`).success).toBe(false);
  });
});

describe('withAppReturnParams', () => {
  it('gắn code và status vào URL không có query', () => {
    expect(withAppReturnParams('nexora://bookings/new/verify', 'BK-ABCD1234', 'success')).toBe(
      'nexora://bookings/new/verify?code=BK-ABCD1234&status=success',
    );
  });

  it('nối thêm vào query sẵn có bằng &', () => {
    expect(
      withAppReturnParams('exp://192.168.0.1:8081/--/bookings/new/verify?x=1', 'BK-1', 'cancelled'),
    ).toBe('exp://192.168.0.1:8081/--/bookings/new/verify?x=1&code=BK-1&status=cancelled');
  });
});
