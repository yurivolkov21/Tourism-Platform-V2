import { type ResetPasswordErrors, validateResetPassword } from '@tourism/core';
import { messages } from '@tourism/i18n';
import type { AuthActions } from './auth-actions';
import { placeAuthError } from './error-channel';

export type ResetPasswordOutcome =
  | { kind: 'done' }
  | { kind: 'fieldErrors'; errors: ResetPasswordErrors }
  | { kind: 'formMessage'; tone: 'error'; text: string }
  | { kind: 'invalidLink' };

/** Hai ô của màn đặt lại mật khẩu, theo đúng thứ tự hiển thị. */
export const RESET_PASSWORD_FIELDS = ['password', 'confirm'] as const;

/**
 * Một lần bấm "Save password".
 *
 * Khác các flow kia đúng một nhánh: `invalidToken` ở MÀN NÀY là kênh 3 —
 * không còn gì để sửa tại chỗ, vì cái hỏng là chính đường link. `placeAuthError`
 * biết luật đó, ở đây chỉ dịch `channel: 'screen'` thành một `kind` cho route.
 */
export async function submitResetPassword(
  input: { token: string; password: string; confirm: string },
  actions: AuthActions,
): Promise<ResetPasswordOutcome> {
  const errors = validateResetPassword(input);
  if (Object.keys(errors).length > 0) return { kind: 'fieldErrors', errors };

  const result = await actions.resetPassword({
    token: input.token,
    newPassword: input.password,
  });
  if (result.ok) return { kind: 'done' };

  if (result.error === 'emailNotVerified') {
    return { kind: 'formMessage', tone: 'error', text: messages.authForms.errors.generic };
  }

  const placement = placeAuthError(result.error, 'resetPassword');
  if (placement.channel === 'screen') return { kind: 'invalidLink' };
  if (placement.channel === 'field' && isResetField(placement.field)) {
    return { kind: 'fieldErrors', errors: { [placement.field]: placement.text } };
  }

  return { kind: 'formMessage', tone: 'error', text: placement.text };
}

function isResetField(field: string): field is (typeof RESET_PASSWORD_FIELDS)[number] {
  return (RESET_PASSWORD_FIELDS as readonly string[]).includes(field);
}
