import { router } from 'expo-router';
import { useState } from 'react';
import { useAuthActions } from '@/features/auth/auth-actions';
import { submitGoogle } from '@/features/auth/google-flow';
import { submitSignIn } from '@/features/auth/sign-in-flow';
import {
  type SignInField,
  SignInScreen,
  type SignInScreenProps,
} from '@/features/auth/sign-in-screen';
import { orpc, withMobileAuth } from '@/lib/api/client';
import { consumePendingIntent } from '@/lib/return-to';

export default function LoginRoute() {
  const actions = useAuthActions();
  const [values, setValues] = useState<Record<SignInField, string>>({ email: '', password: '' });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<SignInField, string>>>({});
  const [formMessage, setFormMessage] = useState<SignInScreenProps['formMessage']>(null);
  const [pending, setPending] = useState(false);

  // Đọc từ bộ nhớ bền (SecureStore)
  const handleSuccess = async () => {
    const intent = await consumePendingIntent();
    if (intent) {
      if (intent.action?.kind === 'wishlist') {
        void orpc.wishlist.set.call(
          { tourId: intent.action.tourId, wished: true },
          { context: withMobileAuth() },
        );
      }
      router.replace(intent.returnTo as '/');
    } else {
      router.replace('/');
    }
  };

  // Gõ lại vào ô nào thì xoá lỗi của ô đó, và xoá luôn khung lỗi cấp form: câu
  // lỗi cũ nói về lần gửi cũ, giữ lại là nói sai.
  const change = (field: SignInField, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setFormMessage(null);
  };

  const submit = async () => {
    if (pending) return;
    setPending(true);
    setFieldErrors({});
    setFormMessage(null);

    const outcome = await submitSignIn(values, actions);
    setPending(false);

    if (outcome.kind === 'fieldErrors') setFieldErrors(outcome.errors);
    if (outcome.kind === 'formMessage') {
      setFormMessage({ tone: outcome.tone, text: outcome.text });
    }
    if (outcome.kind === 'success') handleSuccess();
    if (outcome.kind === 'verifyEmail') {
      // `reason: 'blocked'` để màn Verify đổi phụ đề: khách này không vừa đăng
      // ký, mà bị chặn ngay ở cửa đăng nhập.
      router.push({
        pathname: '/verify-email',
        params: { email: outcome.email, reason: 'blocked' },
      });
    }
  };

  const google = async () => {
    if (pending) return;
    setPending(true);
    setFormMessage(null);

    const outcome = await submitGoogle(actions, 'signIn');
    setPending(false);

    if (outcome.kind === 'success') handleSuccess();
    else setFormMessage({ tone: outcome.tone, text: outcome.text });
  };

  return (
    <SignInScreen
      values={values}
      fieldErrors={fieldErrors}
      formMessage={formMessage}
      pending={pending}
      onChange={change}
      onSubmit={() => void submit()}
      onGoogle={() => void google()}
      onForgot={() => router.push('/forgot-password')}
      onCreateAccount={() => router.navigate('/register')}
      onClose={async () => {
        const intent = await consumePendingIntent();
        router.replace((intent?.returnTo as '/') ?? '/');
      }}
    />
  );
}
