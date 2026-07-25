import type { Metadata } from 'next';
import { AuthScreen } from '@/components/auth/auth-screen';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';

// /reset-password (plan Task 4) — quầy "reissue ticket": phát vé mới, chuyến cũ.
export const metadata: Metadata = {
  title: 'Reset password — Tourism',
  description: 'Pick a new password and get back on board.',
};

export default function ResetPasswordPage() {
  return (
    <AuthScreen
      quote="New key, same door — the mountains didn't move."
      author="Minh Quân, Head of Routes"
    >
      <ResetPasswordForm />
    </AuthScreen>
  );
}
