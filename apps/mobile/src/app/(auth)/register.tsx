import { router } from 'expo-router';
import { useState } from 'react';
import { useAuthActions } from '@/features/auth/auth-actions';
import { submitGoogle } from '@/features/auth/google-flow';
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
    setPending(false);

    if (outcome.kind === 'success') router.replace(consumeReturnPath() ?? '/');
    else setFormMessage({ tone: outcome.tone, text: outcome.text });
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
      onGoogle={() => void google()}
      onSignIn={() => router.navigate('/login')}
      onBack={() => router.back()}
    />
  );
}
