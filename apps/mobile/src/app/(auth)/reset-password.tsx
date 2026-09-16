import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useAuthActions } from '@/features/auth/auth-actions';
import { submitResetPassword } from '@/features/auth/reset-password-flow';
import {
  type ResetPasswordField,
  ResetPasswordScreen,
  type ResetPasswordScreenProps,
} from '@/features/auth/reset-password-screen';

/**
 * Route đặt lại mật khẩu, mở từ link trong email (`nexora://reset-password?token=…`).
 *
 * Thiếu token thì vào THẲNG trạng thái link hỏng — không gọi action nào, vì
 * không có gì để gửi đi và một vòng gọi hỏng chỉ làm khách chờ thêm.
 */
export default function ResetPasswordRoute() {
  const actions = useAuthActions();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = params.token ?? '';

  const [values, setValues] = useState<Record<ResetPasswordField, string>>({
    password: '',
    confirm: '',
  });
  const [fieldErrors, setFieldErrors] = useState<ResetPasswordScreenProps['fieldErrors']>({});
  const [formMessage, setFormMessage] = useState<ResetPasswordScreenProps['formMessage']>(null);
  const [pending, setPending] = useState(false);
  const [invalidLink, setInvalidLink] = useState(false);

  const change = (field: ResetPasswordField, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    setFormMessage(null);
  };

  const submit = async () => {
    if (pending) return;
    setPending(true);
    setFieldErrors({});
    setFormMessage(null);

    const outcome = await submitResetPassword({ ...values, token }, actions);
    setPending(false);

    if (outcome.kind === 'fieldErrors') setFieldErrors(outcome.errors);
    if (outcome.kind === 'formMessage') {
      setFormMessage({ tone: outcome.tone, text: outcome.text });
    }
    if (outcome.kind === 'invalidLink') setInvalidLink(true);
    if (outcome.kind === 'done') {
      router.replace({ pathname: '/success', params: { kind: 'password-updated' } });
    }
  };

  return (
    <ResetPasswordScreen
      values={values}
      fieldErrors={fieldErrors}
      formMessage={formMessage}
      pending={pending}
      invalidLink={invalidLink || token.length === 0}
      onChange={change}
      onSubmit={() => void submit()}
      onRequestNewLink={() => router.replace('/forgot-password')}
      onClose={() => router.replace('/')}
    />
  );
}
