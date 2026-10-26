import { describe, expect, it } from 'vitest';
import { checkoutReturnUrls } from './checkout-return-urls.js';

const WEB = 'https://www.nexora-travel.agency';

describe('checkoutReturnUrls (ADR-0062)', () => {
  it('không có appReturnUrl: giữ nguyên trang success/cancel của web', () => {
    expect(checkoutReturnUrls(WEB, 'BK-ABCD1234')).toEqual({
      successUrl: `${WEB}/checkout/success?code=BK-ABCD1234`,
      cancelUrl: `${WEB}/checkout/cancel?code=BK-ABCD1234`,
    });
  });

  it('có appReturnUrl: cả hai URL trỏ trang chuyển tiếp của web, kèm status và URL app đã encode', () => {
    const app = 'exp://192.168.0.143:8082/--/bookings/new/verify';
    const urls = checkoutReturnUrls(WEB, 'BK-ABCD1234', app);

    expect(urls.successUrl).toBe(
      `${WEB}/checkout/app-return?code=BK-ABCD1234&status=success&to=${encodeURIComponent(app)}`,
    );
    expect(urls.cancelUrl).toBe(
      `${WEB}/checkout/app-return?code=BK-ABCD1234&status=cancelled&to=${encodeURIComponent(app)}`,
    );
  });

  it('URL app ngoài allowlist bị bỏ qua — rơi về trang web, không chuyển tiếp đi đâu', () => {
    expect(checkoutReturnUrls(WEB, 'BK-1', 'https://evil.example').successUrl).toBe(
      `${WEB}/checkout/success?code=BK-1`,
    );
  });
});
