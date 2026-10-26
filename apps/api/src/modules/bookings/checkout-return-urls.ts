import { isAllowedAppReturnUrl } from '@tourism/contract';

/**
 * Hai URL cổng thanh toán trả khách về sau khi trả xong hoặc huỷ (ADR-0062). Mặc định là trang
 * success/cancel của web. App mobile gửi `appReturnUrl` thì cả hai trỏ trang chuyển tiếp
 * `/checkout/app-return` của web — Stripe/PayPal chỉ nhận `https`, không đưa thẳng `nexora://`
 * được. Contract đã chặn URL lạ ở input; kiểm lại ở đây để hàm tự đứng vững nếu ai gọi lệch.
 */
export function checkoutReturnUrls(
  frontendUrl: string,
  code: string,
  appReturnUrl?: string,
): { successUrl: string; cancelUrl: string } {
  if (appReturnUrl === undefined || !isAllowedAppReturnUrl(appReturnUrl)) {
    return {
      successUrl: `${frontendUrl}/checkout/success?code=${code}`,
      cancelUrl: `${frontendUrl}/checkout/cancel?code=${code}`,
    };
  }
  const to = encodeURIComponent(appReturnUrl);
  return {
    successUrl: `${frontendUrl}/checkout/app-return?code=${code}&status=success&to=${to}`,
    cancelUrl: `${frontendUrl}/checkout/app-return?code=${code}&status=cancelled&to=${to}`,
  };
}
