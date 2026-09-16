import { OTP_LENGTH, validateLogin } from '@tourism/core';

// CỔNG của ADR-0042: `@tourism/core` đóng gói y hệt `@tourism/i18n` (ESM dist),
// nhưng "giống" không phải là "đã đo". Spec này là chỗ đo — đỏ thì DỪNG và báo
// user, không tự chế cấu hình jest riêng cho mobile.
describe('cầu sang @tourism/core', () => {
  it('nạp được luật kiểm ô nhập trong jest-expo', () => {
    expect(validateLogin({ email: '', password: '' })).toEqual({
      email: expect.any(String),
      password: expect.any(String),
    });
  });

  it('nạp được hằng số', () => {
    expect(OTP_LENGTH).toBe(6);
  });
});
