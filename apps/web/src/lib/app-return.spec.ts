import { describe, expect, it } from 'vitest';
import { appReturnTarget } from './app-return';

// ADR-0062: trang chuyển tiếp chỉ dựng đích khi `to` qua luật của contract và mã đơn đúng khuôn.
describe('appReturnTarget', () => {
  const app = 'exp://192.168.0.143:8082/--/bookings/new/verify';

  it('đủ tham số hợp lệ → URL app kèm code và status', () => {
    expect(appReturnTarget({ to: app, code: 'BK-ABCD1234', status: 'success' })).toBe(
      `${app}?code=BK-ABCD1234&status=success`,
    );
  });

  it('chỉ nhận status cancelled, mọi giá trị khác quy về success', () => {
    expect(appReturnTarget({ to: app, code: 'BK-ABCD1234', status: 'cancelled' })).toBe(
      `${app}?code=BK-ABCD1234&status=cancelled`,
    );
    expect(appReturnTarget({ to: app, code: 'BK-ABCD1234', status: 'whatever' })).toBe(
      `${app}?code=BK-ABCD1234&status=success`,
    );
  });

  it('`to` ngoài allowlist → null, không chuyển đi đâu', () => {
    expect(
      appReturnTarget({ to: 'https://evil.example', code: 'BK-ABCD1234', status: 'success' }),
    ).toBeNull();
    expect(
      appReturnTarget({ to: 'javascript:alert(1)', code: 'BK-ABCD1234', status: 'success' }),
    ).toBeNull();
  });

  it('thiếu `to` hoặc mã đơn sai khuôn → null', () => {
    expect(appReturnTarget({ code: 'BK-ABCD1234', status: 'success' })).toBeNull();
    expect(appReturnTarget({ to: app, code: 'not-a-code', status: 'success' })).toBeNull();
    expect(appReturnTarget({ to: app, status: 'success' })).toBeNull();
  });
});
