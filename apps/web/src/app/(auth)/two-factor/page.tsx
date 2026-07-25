import type { Metadata } from 'next';
import { AuthScreen } from '@/components/auth/auth-screen';
import { TwoFactorForm } from '@/components/auth/two-factor-form';

// /two-factor (plan Task 5) — TOTP app (spec đã chốt phương thức); recovery
// code toggle mock. Nợ twoFactor plugin Better Auth ghi ở spec.
export const metadata: Metadata = {
  title: 'Two-factor check — Tourism',
  description: 'Enter the six-digit code from your authenticator app.',
};

export default function TwoFactorPage() {
  return (
    <AuthScreen
      quote="Good climbers double-check the knots. So do we."
      author="Minh Quân, Head of Routes"
    >
      <TwoFactorForm />
    </AuthScreen>
  );
}
