import { checkoutDescription } from './checkout-description.js';

/**
 * Dòng mô tả gửi cổng thanh toán (vòng review F17): PayPal Orders v2 chỉ nhận
 * `purchase_units[].description` tối đa 127 ký tự đơn byte — dài hơn là 400,
 * `CHECKOUT_FAILED` mỗi lần khách chọn PayPal. Tên tour giờ tới 160 ký tự.
 */
const bytes = (text: string) => Buffer.byteLength(text, 'utf8');
const SUFFIX = ' (2026-10-01 – 2026-10-03)';

describe('checkoutDescription', () => {
  it('tên ngắn thì giữ nguyên văn cả tên lẫn khoảng ngày', () => {
    expect(checkoutDescription('Hoi An Lantern Walk', '2026-10-01', '2026-10-03')).toBe(
      `Hoi An Lantern Walk${SUFFIX}`,
    );
  });

  it('vừa khít 127 byte thì không cắt, thêm một byte thì cắt', () => {
    const fit = 'x'.repeat(127 - bytes(SUFFIX));
    expect(checkoutDescription(fit, '2026-10-01', '2026-10-03')).toBe(`${fit}${SUFFIX}`);

    const over = checkoutDescription(`${fit}y`, '2026-10-01', '2026-10-03');
    expect(bytes(over)).toBeLessThanOrEqual(127);
    expect(over).not.toBe(`${fit}y${SUFFIX}`);
  });

  it('tên dài bị cắt ở PHẦN TÊN, khoảng ngày còn nguyên, có dấu ba chấm', () => {
    const title = `Ha Long Bay ${'and the islands beyond '.repeat(7)}`.slice(0, 160);
    const result = checkoutDescription(title, '2026-10-01', '2026-10-03');

    expect(bytes(result)).toBeLessThanOrEqual(127);
    expect(result.endsWith(`…${SUFFIX}`)).toBe(true);
    expect(result.startsWith('Ha Long Bay and the islands beyond')).toBe(true);
    // Không để khoảng trắng lơ lửng trước dấu ba chấm.
    expect(result).not.toContain(' …');
  });

  it('tên tiếng Việt có dấu tính theo BYTE và không cắt đôi một ký tự', () => {
    const title = 'Hành trình Hà Giang – Đồng Văn – Mèo Vạc – Mã Pí Lèng – Lũng Cú '.repeat(3);
    const result = checkoutDescription(title, '2026-10-01', '2026-10-03');

    expect(bytes(result)).toBeLessThanOrEqual(127);
    expect(result.endsWith(`…${SUFFIX}`)).toBe(true);
    // Chuỗi đi một vòng UTF-8 mà không đổi = không có code point bị cắt dở.
    expect(Buffer.from(result, 'utf8').toString('utf8')).toBe(result);
    expect(result).not.toContain('�');
  });
});
