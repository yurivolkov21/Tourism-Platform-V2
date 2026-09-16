import { messages } from '@tourism/i18n';
import type { AuthActions } from './auth-actions';
import { type AuthScreenName, placeAuthError } from './error-channel';

export type GoogleOutcome =
  | { kind: 'success' }
  | { kind: 'formMessage'; tone: 'error'; text: string };

/**
 * Một lần bấm "Continue with Google". Dùng chung cho Sign in và Create account
 * vì hai màn làm y hệt nhau: không có ô nào để gắn lỗi, nên mọi thứ hỏng đều rơi
 * về khung cấp form (kênh 2).
 *
 * Giữ riêng khỏi `submitSignIn` vì luồng này không kiểm gì ở máy — không có ô
 * nào để kiểm.
 */
export async function submitGoogle(
  actions: AuthActions,
  screen: AuthScreenName,
): Promise<GoogleOutcome> {
  const result = await actions.signInWithGoogle();
  if (result.ok) return { kind: 'success' };

  // `emailNotVerified` không tới được từ Google (nhà cung cấp đã xác minh email
  // hộ), nhưng kiểu dữ liệu vẫn cho phép — nói một câu chung còn hơn im lặng.
  if (result.error === 'emailNotVerified') {
    return { kind: 'formMessage', tone: 'error', text: messages.authForms.errors.generic };
  }

  const placement = placeAuthError(result.error, screen);

  return {
    kind: 'formMessage',
    tone: 'error',
    text: placement.channel === 'screen' ? messages.authForms.errors.generic : placement.text,
  };
}
