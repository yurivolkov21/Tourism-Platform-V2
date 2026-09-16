import { messages } from '@tourism/i18n';
import type { AuthActions } from './auth-actions';
import { createMockAuthActions } from './mock-auth-actions';
import { resendCode, submitOtp } from './verify-email-flow';

const actions: AuthActions = createMockAuthActions({ delayMs: 0 });
const email = 'lan@example.com';

describe('submitOtp', () => {
  it('mã trống bị chặn ở máy, không gọi tới action', async () => {
    const verifyEmail = jest.fn();

    const outcome = await submitOtp({ email, otp: '' }, { ...actions, verifyEmail });

    expect(outcome).toEqual({
      kind: 'fieldErrors',
      errors: { otp: messages.formErrors.otp.required },
    });
    expect(verifyEmail).not.toHaveBeenCalled();
  });

  it('mã chưa đủ 6 số cũng chặn ở máy — không để khách nhận "mã sai" oan', async () => {
    const verifyEmail = jest.fn();

    const outcome = await submitOtp({ email, otp: '1234' }, { ...actions, verifyEmail });

    expect(outcome).toEqual({
      kind: 'fieldErrors',
      errors: { otp: messages.formErrors.otp.incomplete },
    });
    expect(verifyEmail).not.toHaveBeenCalled();
  });

  it('mã sai hiện dưới ô mã, không phải khung cấp form', async () => {
    const outcome = await submitOtp({ email, otp: '000000' }, actions);

    expect(outcome).toEqual({
      kind: 'fieldErrors',
      errors: { otp: messages.authForms.errors.invalidOtp },
    });
  });

  it('lỗi không quy về ô nào thì ra khung cấp form', async () => {
    const verifyEmail = jest.fn().mockResolvedValue({ ok: false, error: 'tooManyRequests' });

    const outcome = await submitOtp({ email, otp: '123456' }, { ...actions, verifyEmail });

    expect(outcome).toEqual({
      kind: 'formMessage',
      tone: 'error',
      text: messages.authForms.errors.tooManyRequests,
    });
  });

  it('mã đúng thì báo đã xác minh', async () => {
    await expect(submitOtp({ email, otp: '123456' }, actions)).resolves.toEqual({
      kind: 'verified',
    });
  });
});

describe('resendCode', () => {
  it('gửi lại được thì báo đã gửi để màn chạy lại đếm ngược', async () => {
    await expect(resendCode(email, actions)).resolves.toEqual({ kind: 'sent' });
  });

  it('gửi quá nhiều lần thì nói ra ở khung cấp form', async () => {
    await expect(resendCode('busy@example.com', actions)).resolves.toEqual({
      kind: 'formMessage',
      tone: 'error',
      text: messages.authForms.errors.tooManyRequests,
    });
  });
});
