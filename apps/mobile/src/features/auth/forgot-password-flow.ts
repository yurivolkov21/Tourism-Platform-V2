import { validateForgotPassword } from '@tourism/core';
import { messages } from '@tourism/i18n';
import type { AuthActions } from './auth-actions';
import { placeAuthError } from './error-channel';

export type ForgotPasswordOutcome =
  | { kind: 'sent' }
  | { kind: 'fieldErrors'; errors: { email: string } }
  | { kind: 'formMessage'; tone: 'error'; text: string };

/**
 * Một lần bấm "Send the reset link".
 *
 * Bản giả lập LUÔN trả thành công, kể cả email chưa có tài khoản — đúng cách
 * API thật làm, vì trả lời khác nhau là nói cho người lạ biết email nào đã đăng
 * ký. Nhánh lỗi ở đây chỉ dành cho lỗi THẬT (quá nhiều lần, mất mạng).
 */
export async function submitForgotPassword(
  email: string,
  actions: AuthActions,
): Promise<ForgotPasswordOutcome> {
  const emailError = validateForgotPassword(email);
  if (emailError !== undefined) return { kind: 'fieldErrors', errors: { email: emailError } };

  const result = await actions.requestPasswordReset({ email });
  if (result.ok) return { kind: 'sent' };

  if (result.error === 'emailNotVerified') {
    return { kind: 'formMessage', tone: 'error', text: messages.authForms.errors.generic };
  }

  const placement = placeAuthError(result.error, 'forgotPassword');
  if (placement.channel === 'field' && placement.field === 'email') {
    return { kind: 'fieldErrors', errors: { email: placement.text } };
  }

  return {
    kind: 'formMessage',
    tone: 'error',
    text: placement.channel === 'screen' ? messages.authForms.errors.generic : placement.text,
  };
}
