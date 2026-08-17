import type { Metadata } from 'next';
import { AuthScreen } from '@/components/auth/auth-screen';
import { TwoFactorForm } from '@/components/auth/two-factor-form';

// PARK theo ADR-0017 §5b — API chưa bật plugin twoFactor, trang giữ TĨNH làm
// UI dự phòng (nợ có kế hoạch, không nối API ở Task 5 này).
export const metadata: Metadata = {
  title: 'Two-factor check — Tourism',
  description: 'Enter the six-digit code from your authenticator app.',
};

export default function TwoFactorPage() {
  return (
    <AuthScreen
      quote="Good climbers double-check the knots. So do we."
      author="Huỳnh Đại Nghĩa, Head of Routes"
    >
      <TwoFactorForm />
    </AuthScreen>
  );
}
