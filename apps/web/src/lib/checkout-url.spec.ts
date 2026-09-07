import { describe, expect, it } from 'vitest';
import { isCheckoutUrl } from './checkout-url';

// W3-O4 (audit cụm 7, Thấp): checkoutUrl từ API đi thẳng vào
// window.location.assign — guard scheme để một response bị nhiễm không điều
// hướng khách sang javascript:/http lạ. https là luật; localhost http chỉ dev.
describe('isCheckoutUrl', () => {
  it('https bất kỳ → qua (Stripe/PayPal chỉ phát https)', () => {
    expect(isCheckoutUrl('https://checkout.stripe.test/c/pay/cs_123', 'production')).toBe(true);
    expect(isCheckoutUrl('https://www.sandbox.paypal.com/checkoutnow?token=x', 'production')).toBe(
      true,
    );
  });

  it('javascript:/data:/http origin lạ → chặn ở mọi môi trường', () => {
    for (const nodeEnv of ['development', 'production']) {
      expect(isCheckoutUrl('javascript:alert(1)', nodeEnv)).toBe(false);
      expect(isCheckoutUrl('data:text/html,x', nodeEnv)).toBe(false);
      expect(isCheckoutUrl('http://evil.example/pay', nodeEnv)).toBe(false);
    }
  });

  it('http://localhost chỉ qua NGOÀI production (Stripe CLI/dev)', () => {
    expect(isCheckoutUrl('http://localhost:4242/pay', 'development')).toBe(true);
    expect(isCheckoutUrl('http://127.0.0.1:4242/pay', 'development')).toBe(true);
    expect(isCheckoutUrl('http://localhost:4242/pay', 'production')).toBe(false);
  });

  it('chuỗi không phải URL / rỗng → chặn, không throw', () => {
    expect(isCheckoutUrl('', 'development')).toBe(false);
    expect(isCheckoutUrl('không phải url', 'development')).toBe(false);
  });
});
