import {
  type AuthErrorKey,
  type ChangePasswordErrors,
  validateChangePassword,
} from '@tourism/core';
import { messages } from '@tourism/i18n';
import { placeAuthError } from '@/features/auth/error-channel';

export const CHANGE_PASSWORD_FIELDS = [
  'currentPassword',
  'newPassword',
  'confirmPassword',
] as const;
export type ChangePasswordField = (typeof CHANGE_PASSWORD_FIELDS)[number];

export type ChangePasswordOutcome =
  | { kind: 'done' }
  | { kind: 'fieldErrors'; errors: ChangePasswordErrors }
  | { kind: 'formMessage'; tone: 'error'; text: string };

/** Kết quả gọi `authClient.changePassword` — cùng hình dạng `AuthResult` của
    cụm `(auth)`, nhưng tách riêng interface: màn này đã đăng nhập, không đi
    qua `AuthActions` (seam đó chỉ phủ luồng sign-in/up/verify/reset). */
export type ChangePasswordAction = (input: {
  currentPassword: string;
  newPassword: string;
}) => Promise<{ ok: true } | { ok: false; error: AuthErrorKey }>;

/**
 * Một lần bấm "Save password" (A6, spec P5b-4 §3).
 *
 * Chỉ MỘT lỗi server quy được về ô: mật khẩu hiện tại sai (`wrongCurrentPassword`
 * → field `currentPassword`). Mọi lỗi khác — kể cả lỗi khác quy được về "ô mật
 * khẩu" theo `placeAuthError` (vd `passwordTooShort` không nên xảy ra vì client
 * đã kiểm trước) — rơi về khung cấp form, ĐÚNG spec, không đoán thêm map field.
 */
export async function submitChangePassword(
  input: { currentPassword: string; newPassword: string; confirmPassword: string },
  changePassword: ChangePasswordAction,
): Promise<ChangePasswordOutcome> {
  const errors = validateChangePassword(input);
  if (Object.keys(errors).length > 0) return { kind: 'fieldErrors', errors };

  const result = await changePassword({
    currentPassword: input.currentPassword,
    newPassword: input.newPassword,
  });
  if (result.ok) return { kind: 'done' };

  const placement = placeAuthError(result.error, 'changePassword');
  if (placement.channel === 'field' && placement.field === 'currentPassword') {
    return { kind: 'fieldErrors', errors: { currentPassword: placement.text } };
  }
  // Kênh 'screen' chỉ nổ ở màn resetPassword (invalidToken) — không xảy ra ở
  // đây, nhưng `ErrorPlacement` là union chung nên vẫn phải xử lý cho tsc.
  if (placement.channel === 'screen') {
    return { kind: 'formMessage', tone: 'error', text: messages.authForms.errors.generic };
  }

  return { kind: 'formMessage', tone: 'error', text: placement.text };
}
