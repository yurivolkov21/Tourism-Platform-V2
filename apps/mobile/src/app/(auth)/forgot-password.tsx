import { validateForgotPassword } from '@tourism/core';
import { router } from 'expo-router';
import { useState } from 'react';
import { useAuthActions } from '@/features/auth/auth-actions';
import { submitForgotPassword } from '@/features/auth/forgot-password-flow';
import {
  ForgotPasswordScreen,
  type ForgotPasswordScreenProps,
} from '@/features/auth/forgot-password-screen';

/**
 * Route quên mật khẩu. `sent` đổi khung NGAY TẠI CHỖ chứ không đẩy thêm một màn:
 * vẫn là một việc, và bấm back từ lời nhắn hộp thư phải về Sign in.
 *
 * "Back to sign in" dùng `dismissTo`, không `replace`: màn này thường mở từ
 * link "Forgot password?" nên Sign in đang nằm ngay dưới, và `replace` dựng thêm
 * một bản Sign in chồng lên bản đó — back một lần lại ra Sign in (review M1).
 * Mở từ "Request a new link" của Reset password thì chưa có Sign in nào, và
 * `dismissTo` thay màn hiện tại bằng Sign in.
 */
export default function ForgotPasswordRoute() {
  const actions = useAuthActions();
  const [email, setEmail] = useState('');
  const [fieldErrors, setFieldErrors] = useState<ForgotPasswordScreenProps['fieldErrors']>({});
  const [formMessage, setFormMessage] = useState<ForgotPasswordScreenProps['formMessage']>(null);
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  const change = (next: string) => {
    setEmail(next);
    setFieldErrors({});
    setFormMessage(null);
  };

  const submit = async () => {
    if (pending) return;
    // Kiểm tra ô trống/sai định dạng NGAY, trước khi bật `pending` — không thì nút nháy sang
    // "Signing in…" một nhịp rồi mới hiện lỗi.
    const emailError = validateForgotPassword(email);
    if (emailError !== undefined) {
      setFieldErrors({ email: emailError });
      setFormMessage(null);
      return;
    }
    setPending(true);
    setFieldErrors({});
    setFormMessage(null);

    const outcome = await submitForgotPassword(email, actions);
    setPending(false);

    if (outcome.kind === 'fieldErrors') setFieldErrors(outcome.errors);
    if (outcome.kind === 'formMessage') {
      setFormMessage({ tone: outcome.tone, text: outcome.text });
    }
    if (outcome.kind === 'sent') setSent(true);
  };

  return (
    <ForgotPasswordScreen
      email={email}
      fieldErrors={fieldErrors}
      formMessage={formMessage}
      pending={pending}
      sent={sent}
      onChangeEmail={change}
      onSubmit={() => void submit()}
      onBackToSignIn={() => router.dismissTo('/login')}
      onBack={() => router.back()}
    />
  );
}
