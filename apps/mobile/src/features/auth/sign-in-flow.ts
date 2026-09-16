import { type LoginErrors, validateLogin } from '@tourism/core';
import { messages } from '@tourism/i18n';
import type { AuthActions } from './auth-actions';
import { placeAuthError } from './error-channel';

export type SignInOutcome =
  | { kind: 'success' }
  | { kind: 'fieldErrors'; errors: LoginErrors }
  | { kind: 'formMessage'; tone: 'error'; text: string }
  | { kind: 'verifyEmail'; email: string };

/** Hai ô của màn Sign in, theo đúng thứ tự hiển thị. */
export const SIGN_IN_FIELDS = ['email', 'password'] as const;

/**
 * Một lần bấm "Sign in", từ đầu tới cuối (spec P5b-1 §5):
 *
 * 1. kiểm ở máy trước — lỗi ở đây không tốn một lượt gọi nào;
 * 2. gọi `AuthActions`;
 * 3. lỗi trả về đi qua `placeAuthError` để biết hiện ở kênh nào.
 *
 * `emailNotVerified` KHÔNG đi qua bước 3: nó không phải câu để đọc mà là lệnh
 * chuyển sang màn Verify.
 */
export async function submitSignIn(
  input: { email: string; password: string },
  actions: AuthActions,
): Promise<SignInOutcome> {
  const errors = validateLogin(input);
  if (Object.keys(errors).length > 0) return { kind: 'fieldErrors', errors };

  const result = await actions.signInWithEmail(input);
  if (result.ok) return { kind: 'success' };
  if (result.error === 'emailNotVerified') {
    return { kind: 'verifyEmail', email: input.email.trim() };
  }

  const placement = placeAuthError(result.error, 'signIn');
  if (placement.channel === 'field' && isSignInField(placement.field)) {
    return { kind: 'fieldErrors', errors: { [placement.field]: placement.text } };
  }

  // Lỗi quy về một ô mà màn này KHÔNG có (vd ô mã xác minh) thì vẫn phải nói ra
  // chỗ nào đó — rơi về khung cấp form còn hơn nuốt mất.
  return {
    kind: 'formMessage',
    tone: 'error',
    text: placement.channel === 'screen' ? messages.authForms.errors.generic : placement.text,
  };
}

function isSignInField(field: string): field is (typeof SIGN_IN_FIELDS)[number] {
  return (SIGN_IN_FIELDS as readonly string[]).includes(field);
}
