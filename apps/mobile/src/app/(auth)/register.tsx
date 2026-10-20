import { router } from 'expo-router';
import { useState } from 'react';
import { useAuthActions } from '@/features/auth/auth-actions';
import { submitGoogle } from '@/features/auth/google-flow';
import { canUseGoogleSignIn } from '@/features/auth/google-native';
import { leaveAuthTo, useStillMounted } from '@/features/auth/leave-auth';
import { submitRegister } from '@/features/auth/register-flow';
import {
  type RegisterField,
  RegisterScreen,
  type RegisterScreenProps,
} from '@/features/auth/register-screen';
import { consumeReturnPath } from '@/features/auth/return-to';

/** Cùng khuôn với `login.tsx`; khác ở ô tick Terms và đích sau khi gửi. */
export default function RegisterRoute() {
  const actions = useAuthActions();
  const [values, setValues] = useState<Record<RegisterField, string>>({
    name: '',
    email: '',
    password: '',
  });
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<RegisterField, string>>>({});
  const [formMessage, setFormMessage] = useState<RegisterScreenProps['formMessage']>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [pending, setPending] = useState(false);
  const mounted = useStillMounted();
  // ADR-0056 §2: Expo Go hay build thiếu env Google thì không vẽ nút Google.
  // Môi trường chạy không đổi trong một phiên app nên đọc một lần là đủ.
  const [showGoogle] = useState(canUseGoogleSignIn);

  const change = (field: RegisterField, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setFormMessage(null);
  };

  const submit = async () => {
    if (pending || !agreedToTerms) return;
    setPending(true);
    setFieldErrors({});
    setFormMessage(null);

    const outcome = await submitRegister(values, actions);
    setPending(false);

    if (outcome.kind === 'fieldErrors') setFieldErrors(outcome.errors);
    if (outcome.kind === 'formMessage') {
      setFormMessage({ tone: outcome.tone, text: outcome.text });
    }
    if (outcome.kind === 'verifyEmail') {
      // Không kèm `reason`: khách vừa tự đăng ký nên phụ đề mặc định là đúng.
      router.push({ pathname: '/verify-email', params: { email: outcome.email } });
    }
  };

  const google = async () => {
    if (pending) return;
    setPending(true);
    setFormMessage(null);

    const outcome = await submitGoogle(actions, 'register');
    // R7: xong thì giữ `pending` — xem `login.tsx`.
    if (outcome.kind === 'success') {
      leaveAuthTo(router, consumeReturnPath(), mounted.current);
      return;
    }
    setPending(false);

    if (outcome.kind === 'formMessage') {
      setFormMessage({ tone: outcome.tone, text: outcome.text });
    }
    // `cancelled`: khách tự đóng cửa sổ Google — màn đứng nguyên, không báo gì.
  };

  return (
    <RegisterScreen
      values={values}
      fieldErrors={fieldErrors}
      formMessage={formMessage}
      pending={pending}
      agreedToTerms={agreedToTerms}
      onChange={change}
      onAgreeChange={setAgreedToTerms}
      onSubmit={() => void submit()}
      showGoogle={showGoogle}
      onGoogle={() => void google()}
      // `dismissTo`: mở từ Sign in thì Sign in đang nằm ngay dưới — `navigate`
      // đẩy thêm một bản mới, qua lại hai link là stack dài mãi (review M1). Mở
      // thẳng từ cổng "Create account" của các tab thì thay màn này bằng Sign in.
      onSignIn={() => router.dismissTo('/login')}
      onBack={() => router.back()}
    />
  );
}
