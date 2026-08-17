import type { Metadata } from 'next';
import { AuthScreen } from '@/components/auth/auth-screen';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';

// /forgot-password (plan Task 4) — quầy "lost ticket desk" của nhà ga.
export const metadata: Metadata = {
  title: 'Forgot password — Tourism',
  description: 'Tell us your email and we will send a reset link.',
};

export default function ForgotPasswordPage() {
  return (
    <AuthScreen
      quote="Losing the trail is part of the trek. A guide walks you back."
      author="Mạnh Duy An, Head of Guides"
    >
      <ForgotPasswordForm />
    </AuthScreen>
  );
}
