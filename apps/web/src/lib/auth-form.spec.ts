import { messages } from '@tourism/i18n';
import { describe, expect, it } from 'vitest';
import {
  validateChangePassword,
  validateForgotPassword,
  validateLogin,
  validateOtp,
  validateProfileName,
  validateProfilePhone,
  validateRegister,
  validateResetPassword,
} from './auth-form';

const t = messages.formErrors;
const LONG_PASSWORD = 'a'.repeat(129);

describe('validateLogin', () => {
  it('cả hai ô trống → báo required ở TỪNG ô, không gom', () => {
    expect(validateLogin({ email: '', password: '' })).toEqual({
      email: t.email.required,
      password: t.password.required,
    });
  });

  it('email toàn khoảng trắng coi như trống', () => {
    expect(validateLogin({ email: '   ', password: 'x' }).email).toBe(t.email.required);
  });

  it('email sai định dạng → invalid (khác câu required)', () => {
    expect(validateLogin({ email: 'minh@', password: 'x' }).email).toBe(t.email.invalid);
  });

  it('login KHÔNG chặn mật khẩu ngắn — server mới biết đúng/sai, client chỉ bắt trống', () => {
    expect(validateLogin({ email: 'minh@example.com', password: 'abc' })).toEqual({});
  });

  it('hợp lệ → rỗng', () => {
    expect(validateLogin({ email: 'minh@example.com', password: 'Sup3r$ecret' })).toEqual({});
  });
});

describe('validateRegister', () => {
  it('ba ô trống → ba câu required riêng', () => {
    expect(validateRegister({ name: '', email: '', password: '' })).toEqual({
      name: t.name.required,
      email: t.email.required,
      password: t.password.required,
    });
  });

  it('mật khẩu < 8 → tooShort (soi gương PASSWORD_TOO_SHORT của Better Auth)', () => {
    expect(validateRegister({ name: 'Minh', email: 'a@b.co', password: 'short7' }).password).toBe(
      t.password.tooShort,
    );
  });

  it('mật khẩu > 128 → tooLong', () => {
    expect(
      validateRegister({ name: 'Minh', email: 'a@b.co', password: LONG_PASSWORD }).password,
    ).toBe(t.password.tooLong);
  });

  it('tên chỉ 1 ký tự → tooShort (name ≥2, cùng ngưỡng enquiry)', () => {
    expect(validateRegister({ name: 'M', email: 'a@b.co', password: 'Sup3r$ecret' }).name).toBe(
      t.name.tooShort,
    );
  });

  it('hợp lệ → rỗng', () => {
    expect(
      validateRegister({ name: 'Tran Mai Anh', email: 'a@b.co', password: 'Sup3r$ecret' }),
    ).toEqual({});
  });
});

describe('validateForgotPassword', () => {
  it('trống → required; sai định dạng → invalid; hợp lệ → undefined', () => {
    expect(validateForgotPassword('')).toBe(t.email.required);
    expect(validateForgotPassword('nope')).toBe(t.email.invalid);
    expect(validateForgotPassword('a@b.co')).toBeUndefined();
  });
});

describe('validateResetPassword', () => {
  it('cả hai trống → required ở cả hai ô', () => {
    expect(validateResetPassword({ password: '', confirm: '' })).toEqual({
      password: t.newPassword.required,
      confirm: t.confirmPassword.required,
    });
  });

  it('mật khẩu ngắn → tooShort; confirm khác → mismatch', () => {
    expect(validateResetPassword({ password: 'short7', confirm: 'other' })).toEqual({
      password: t.newPassword.tooShort,
      confirm: t.confirmPassword.mismatch,
    });
  });

  it('confirm khác mật khẩu (mật khẩu đã hợp lệ) → chỉ mismatch', () => {
    expect(validateResetPassword({ password: 'Sup3r$ecret', confirm: 'Sup3r$ecre' })).toEqual({
      confirm: t.confirmPassword.mismatch,
    });
  });

  it('khớp và đủ dài → rỗng', () => {
    expect(validateResetPassword({ password: 'Sup3r$ecret', confirm: 'Sup3r$ecret' })).toEqual({});
  });
});

describe('validateChangePassword', () => {
  it('ba ô trống → ba câu required riêng', () => {
    expect(
      validateChangePassword({ currentPassword: '', newPassword: '', confirmPassword: '' }),
    ).toEqual({
      currentPassword: t.currentPassword.required,
      newPassword: t.newPassword.required,
      confirmPassword: t.confirmPassword.required,
    });
  });

  it('mật khẩu hiện tại KHÔNG bị soi độ dài (server mới biết đúng/sai)', () => {
    expect(
      validateChangePassword({
        currentPassword: 'x',
        newPassword: 'Sup3r$ecret',
        confirmPassword: 'Sup3r$ecret',
      }),
    ).toEqual({});
  });

  it('mới ngắn → tooShort; confirm lệch → mismatch', () => {
    expect(
      validateChangePassword({
        currentPassword: 'old',
        newPassword: 'short7',
        confirmPassword: 'short8',
      }),
    ).toEqual({
      newPassword: t.newPassword.tooShort,
      confirmPassword: t.confirmPassword.mismatch,
    });
  });
});

describe('validateOtp', () => {
  it('trống → required; thiếu chữ số → incomplete; đủ 6 → undefined', () => {
    expect(validateOtp('')).toBe(t.otp.required);
    expect(validateOtp('123')).toBe(t.otp.incomplete);
    expect(validateOtp('123456')).toBeUndefined();
  });
});

describe('validateProfileName', () => {
  it('trống/khoảng trắng → required; quá 120 → tooLong; hợp lệ → undefined', () => {
    expect(validateProfileName('')).toBe(t.name.required);
    expect(validateProfileName('   ')).toBe(t.name.required);
    expect(validateProfileName('a'.repeat(121))).toBe(t.name.tooLong);
    expect(validateProfileName('Minh')).toBeUndefined();
  });
});

describe('validateProfilePhone', () => {
  it('trống là hợp lệ (phone optional); có thì phải 6–30 ký tự', () => {
    expect(validateProfilePhone('')).toBeUndefined();
    expect(validateProfilePhone('  ')).toBeUndefined();
    expect(validateProfilePhone('12345')).toBe(t.phone.invalid);
    expect(validateProfilePhone('1'.repeat(31))).toBe(t.phone.invalid);
    expect(validateProfilePhone('+84 912 345 678')).toBeUndefined();
  });
});
