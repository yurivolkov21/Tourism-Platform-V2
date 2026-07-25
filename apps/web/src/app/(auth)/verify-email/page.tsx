import type { Metadata } from 'next';
import { AuthScreen } from '@/components/auth/auth-screen';
import { OtpForm } from '@/components/auth/otp-form';

// /verify-email (plan Task 5) — "boarding check" soát vé email; backend đã
// gate emailVerified (ADR-0008) nên trang này có móc thật khi wire API.
export const metadata: Metadata = {
  title: 'Verify your email — Tourism',
  description: 'We mailed you six digits — enter them to confirm your address.',
};

export default function VerifyEmailPage() {
  return (
    <AuthScreen
      quote="A ticket only counts once it's stamped."
      author="Ngọc Lan, Head of Operations"
    >
      <OtpForm
        stub="BOARDING CHECK · EMAIL · GATE: VERIFY"
        heading={
          <>
            We mailed you
            <span className="text-primary italic"> six digits.</span>
          </>
        }
        description="Enter the code we sent to confirm your email address."
        submitLabel="Stamp my ticket"
      />
    </AuthScreen>
  );
}
