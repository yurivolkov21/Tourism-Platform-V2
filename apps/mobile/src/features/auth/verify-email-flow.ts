import { validateOtp } from '@tourism/core';
import { messages } from '@tourism/i18n';
import type { AuthActions } from './auth-actions';
import { placeAuthError } from './error-channel';

export type OtpOutcome =
  | { kind: 'verified' }
  | { kind: 'fieldErrors'; errors: { otp: string } }
  | { kind: 'formMessage'; tone: 'error'; text: string };

export type ResendOutcome = { kind: 'sent' } | { kind: 'formMessage'; tone: 'error'; text: string };

/**
 * Một lần bấm "Verify". Cùng ba bước với `submitSignIn`: kiểm ở máy → gọi
 * action → `placeAuthError` chọn kênh.
 *
 * Kiểm ở máy quan trọng hơn ở đây so với các màn khác: gửi mã trống mà vẫn gọi
 * API thì khách nhận câu "mã sai" cho một mã mình chưa hề gõ (bài học từ web).
 */
export async function submitOtp(
  input: { email: string; otp: string },
  actions: AuthActions,
): Promise<OtpOutcome> {
  const otpError = validateOtp(input.otp);
  if (otpError !== undefined) return { kind: 'fieldErrors', errors: { otp: otpError } };

  const result = await actions.verifyEmail(input);
  if (result.ok) return { kind: 'verified' };

  // `emailNotVerified` ở đây vô nghĩa (đang đứng ở chính màn xác minh) nhưng kiểu
  // dữ liệu vẫn cho phép — nói một câu chung còn hơn im lặng.
  if (result.error === 'emailNotVerified') {
    return { kind: 'formMessage', tone: 'error', text: messages.authForms.errors.generic };
  }

  const placement = placeAuthError(result.error, 'verifyEmail');
  if (placement.channel === 'field' && placement.field === 'otp') {
    return { kind: 'fieldErrors', errors: { otp: placement.text } };
  }

  return {
    kind: 'formMessage',
    tone: 'error',
    text: placement.channel === 'screen' ? messages.authForms.errors.generic : placement.text,
  };
}

/**
 * Bấm "Resend code". Thành công KHÔNG phải lỗi nên không đi qua `placeAuthError`:
 * màn tự hiện khung thông tin (`verifyEmail.resent`) và chạy lại đếm ngược.
 */
export async function resendCode(email: string, actions: AuthActions): Promise<ResendOutcome> {
  const result = await actions.resendVerificationCode({ email });
  if (result.ok) return { kind: 'sent' };

  if (result.error === 'emailNotVerified') {
    return { kind: 'formMessage', tone: 'error', text: messages.authForms.errors.generic };
  }

  const placement = placeAuthError(result.error, 'verifyEmail');

  return {
    kind: 'formMessage',
    tone: 'error',
    text: placement.channel === 'screen' ? messages.authForms.errors.generic : placement.text,
  };
}
