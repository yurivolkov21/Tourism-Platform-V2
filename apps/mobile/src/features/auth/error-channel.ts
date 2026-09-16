import { type AuthErrorField, type AuthErrorKey, fieldOfAuthError } from '@tourism/core';
import { messages } from '@tourism/i18n';

/** Các màn của cụm auth — dùng để quyết một mã lỗi có làm hỏng cả màn hay không. */
export type AuthScreenName =
  | 'signIn'
  | 'register'
  | 'verifyEmail'
  | 'forgotPassword'
  | 'resetPassword';

export type ErrorPlacement =
  | { channel: 'field'; field: AuthErrorField; text: string }
  | { channel: 'form'; text: string }
  | { channel: 'screen'; state: 'invalidLink' };

/**
 * Chỗ DUY NHẤT quyết một lỗi hiện ở đâu (spec P5b-1 §5):
 *
 * 1. quy được về một ô → kênh 1, nằm dưới ô đó;
 * 2. không quy được nhưng màn còn thử lại được → kênh 2, khung ngay trên nút chính;
 * 3. màn hết đường dùng → kênh 3, thay cả thân màn.
 *
 * Màn KHÔNG tự chọn kênh. Nhờ vậy hai màn không thể nói khác nhau về cùng một mã
 * lỗi, và đổi luật thì đổi đúng một chỗ.
 */
export function placeAuthError(key: AuthErrorKey, screen: AuthScreenName): ErrorPlacement {
  // Token hỏng chỉ giết được MÀN đặt lại mật khẩu — ở màn khác nó chỉ là một lần
  // thử hỏng, vẫn còn ô để sửa.
  if (key === 'invalidToken' && screen === 'resetPassword') {
    return { channel: 'screen', state: 'invalidLink' };
  }

  const field = fieldOfAuthError(key);
  const text = messages.authForms.errors[key];

  return field === null ? { channel: 'form', text } : { channel: 'field', field, text };
}
