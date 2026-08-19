import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthScreen } from '@/components/auth/auth-screen';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { AUTH_PANEL_SLOT, siteMediaImage } from '@/lib/api/site-media';

// /reset-password (plan Task 4) — quầy "reissue ticket": phát vé mới, chuyến cũ.
export const metadata: Metadata = {
  title: 'Reset password — Nexora',
  description: 'Pick a new password and get back on board.',
};

export default async function ResetPasswordPage() {
  // Ảnh panel lấy ở TRANG (server component) rồi truyền xuống `AuthScreen` —
  // component đó là `'use client'` vì dùng motion, nên không tự fetch được.
  // Đây là quy ước đã ghi ở đầu `slot-image.tsx`, áp cho cả chín chỗ dùng khe.
  const image = await siteMediaImage(AUTH_PANEL_SLOT);

  return (
    <AuthScreen
      image={image}
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
