import { type RegisterErrors, validateRegister } from '@tourism/core';
import { messages } from '@tourism/i18n';
import type { AuthActions } from './auth-actions';
import { placeAuthError } from './error-channel';

export type RegisterOutcome =
  | { kind: 'verifyEmail'; email: string }
  | { kind: 'fieldErrors'; errors: RegisterErrors }
  | { kind: 'formMessage'; tone: 'error'; text: string };

/** Ba ô của màn Create account, theo đúng thứ tự hiển thị. */
export const REGISTER_FIELDS = ['name', 'email', 'password'] as const;

/**
 * Một lần bấm "Create account". Cùng ba bước với `submitSignIn`, khác hai chỗ:
 *
 * - kiểm bằng `validateRegister` (có thêm ô tên);
 * - **thành công cũng dẫn sang màn Verify**, không vào thẳng app. API cố ý trả
 *   thành công cả khi email đã có tài khoản (che chuyện email nào đã đăng ký),
 *   nên màn Verify là nơi DUY NHẤT nói được điều đó — bằng câu nhắc
 *   `authForms.verifyEmail.existingAccountHint`.
 */
export async function submitRegister(
  input: { name: string; email: string; password: string },
  actions: AuthActions,
): Promise<RegisterOutcome> {
  const errors = validateRegister(input);
  if (Object.keys(errors).length > 0) return { kind: 'fieldErrors', errors };

  const result = await actions.signUpWithEmail(input);
  if (result.ok) return { kind: 'verifyEmail', email: input.email.trim() };
  if (result.error === 'emailNotVerified') {
    return { kind: 'verifyEmail', email: input.email.trim() };
  }

  const placement = placeAuthError(result.error, 'register');
  if (placement.channel === 'field' && isRegisterField(placement.field)) {
    return { kind: 'fieldErrors', errors: { [placement.field]: placement.text } };
  }

  return {
    kind: 'formMessage',
    tone: 'error',
    text: placement.channel === 'screen' ? messages.authForms.errors.generic : placement.text,
  };
}

function isRegisterField(field: string): field is (typeof REGISTER_FIELDS)[number] {
  return (REGISTER_FIELDS as readonly string[]).includes(field);
}
