import type { Metadata } from 'next';
import { AuthScreen } from '@/components/auth/auth-screen';
import { OtpForm } from '@/components/auth/otp-form';

// /verify-email (plan Task 5) — "boarding check" soát vé email; backend đã
// gate emailVerified (ADR-0008), nay nối API thật (emailOTP, Task 1).
export const metadata: Metadata = {
  title: 'Verify your email — Tourism',
  description: 'We mailed you six digits — enter them to confirm your address.',
};

interface VerifyEmailPageProps {
  // Next 16: searchParams là Promise ở server component.
  searchParams: Promise<{ email?: string; redirect?: string }>;
}

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  // Đọc `?email=` (register-form Task 3 push tới đây) + `?redirect=` ở SERVER
  // rồi truyền prop xuống OtpForm (client) — không cần useSearchParams/Suspense
  // vì form không tự đọc query (khác nếp /login, /reset-password).
  const { email, redirect } = await searchParams;

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
            <span className="text-primary-emphasis italic"> six digits.</span>
          </>
        }
        description="Enter the code we sent to confirm your email address."
        submitLabel="Stamp my ticket"
        email={email ?? null}
        redirect={redirect ?? null}
      />
    </AuthScreen>
  );
}
