import { messages } from '@tourism/i18n';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useAuthActions } from '@/features/auth/auth-actions';
import { InfoState } from '@/features/auth/info-state';
import { useCountdown } from '@/features/auth/use-countdown';
import { resendCode, submitOtp } from '@/features/auth/verify-email-flow';
import {
  VerifyEmailScreen,
  type VerifyEmailScreenProps,
} from '@/features/auth/verify-email-screen';

/** Số giây phải chờ trước khi được xin mã mới — khớp bậc chờ của Better Auth. */
const RESEND_COOLDOWN_SECONDS = 60;

/**
 * Route xác minh email. Nhận `email` (bắt buộc) và `reason` từ query:
 * `blocked` là bị Sign in đẩy sang vì chưa xác minh, còn lại là vừa đăng ký.
 */
export default function VerifyEmailRoute() {
  const actions = useAuthActions();
  const params = useLocalSearchParams<{ email?: string; reason?: string }>();
  const email = params.email ?? '';

  const [otp, setOtp] = useState('');
  const [fieldErrors, setFieldErrors] = useState<VerifyEmailScreenProps['fieldErrors']>({});
  const [formMessage, setFormMessage] = useState<VerifyEmailScreenProps['formMessage']>(null);
  const [pending, setPending] = useState(false);
  const { remaining, restart } = useCountdown(RESEND_COOLDOWN_SECONDS);

  // Không có email thì màn này không làm gì được: không biết gửi mã cho ai, mà
  // gõ mã vào cũng chẳng gửi đi đâu. Kênh 3 — thay cả thân màn (spec §5).
  if (email.length === 0) {
    const copy = messages.authForms.verifyEmail.noEmail;

    return (
      <InfoState
        icon="mail"
        title={copy.heading}
        body={copy.body}
        actionLabel={copy.backLink}
        onAction={() => router.replace('/login')}
      />
    );
  }

  const changeOtp = (next: string) => {
    setOtp(next);
    setFieldErrors({});
    setFormMessage(null);
  };

  const submit = async () => {
    if (pending) return;
    setPending(true);
    setFieldErrors({});
    setFormMessage(null);

    const outcome = await submitOtp({ email, otp }, actions);
    setPending(false);

    if (outcome.kind === 'fieldErrors') setFieldErrors(outcome.errors);
    if (outcome.kind === 'formMessage') {
      setFormMessage({ tone: outcome.tone, text: outcome.text });
    }
    if (outcome.kind === 'verified') {
      // `replace`: xác minh xong thì không còn đường lùi về ô nhập mã.
      router.replace({ pathname: '/success', params: { kind: 'verified' } });
    }
  };

  const resend = async () => {
    if (pending || remaining > 0) return;
    setPending(true);
    setFormMessage(null);

    const outcome = await resendCode(email, actions);
    setPending(false);

    if (outcome.kind === 'sent') {
      restart();
      setOtp('');
      setFormMessage({ tone: 'info', text: messages.mobile.auth.verifyEmail.resent });
      return;
    }

    setFormMessage({ tone: outcome.tone, text: outcome.text });
  };

  return (
    <VerifyEmailScreen
      email={email}
      reason={params.reason === 'blocked' ? 'blocked' : 'signup'}
      otp={otp}
      fieldErrors={fieldErrors}
      formMessage={formMessage}
      pending={pending}
      remaining={remaining}
      onChangeOtp={changeOtp}
      onSubmit={() => void submit()}
      onResend={() => void resend()}
      onBack={() => router.back()}
    />
  );
}
