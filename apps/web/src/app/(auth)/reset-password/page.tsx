import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthScreen } from '@/components/auth/auth-screen';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { AUTH_PANEL_SLOT, siteMediaImage } from '@/lib/api/site-media';

// /reset-password (plan Task 4) — quầy "reissue ticket": phát vé mới, chuyến cũ.
export const metadata: Metadata = {
  title: messages.authForms.pages.resetPassword.title,
  description: messages.authForms.pages.resetPassword.description,
};

export default async function ResetPasswordPage() {
  // Ảnh panel lấy ở TRANG (server component) rồi truyền xuống `AuthScreen` —
  // component đó là `'use client'` vì dùng motion, nên không tự fetch được.
  // Đây là quy ước đã ghi ở đầu `slot-image.tsx`, áp cho cả chín chỗ dùng khe.
  const image = await siteMediaImage(AUTH_PANEL_SLOT);

  return (
    <AuthScreen
      image={image}
      quote={messages.authForms.pages.resetPassword.quote}
      author={messages.authForms.pages.resetPassword.author}
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
