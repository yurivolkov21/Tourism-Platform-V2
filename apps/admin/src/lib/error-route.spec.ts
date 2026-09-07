import { describe, expect, it } from 'vitest';
import { ADMIN_FORBIDDEN_DIGEST } from './api/forbidden';
import { routeForErrorDigest } from './error-route';

// ADR-0026 AMEND 3 §B — admin bị thu hồi role giữa phiên phải về đúng cửa
// /not-authorized; mọi digest khác (hash Next sinh, undefined) ở lại màn
// lỗi chung với nút Try again.
describe('routeForErrorDigest', () => {
  it('digest ADMIN_FORBIDDEN → /not-authorized', () => {
    expect(routeForErrorDigest(ADMIN_FORBIDDEN_DIGEST)).toBe('/not-authorized');
  });

  it('digest khác hoặc vắng → null (ở lại boundary)', () => {
    expect(routeForErrorDigest('1234567890')).toBeNull();
    expect(routeForErrorDigest(undefined)).toBeNull();
  });
});
