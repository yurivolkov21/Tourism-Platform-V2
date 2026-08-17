import type { Metadata } from 'next';
import { Suspense } from 'react';
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
      author="Huỳnh Đại Nghĩa, Head of Routes"
    >
      {/* Task 4: ResetPasswordForm đọc `token` qua useSearchParams — cùng lý
          do Suspense của /login (Task 3): Next 16 bắt buộc bọc Suspense
          quanh client component dùng hook này khi prerender static. */}
      <Suspense fallback={null}>
        <ResetPasswordForm />
      </Suspense>
    </AuthScreen>
  );
}
