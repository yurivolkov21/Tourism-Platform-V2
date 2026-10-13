import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { AuthScreen } from '@/components/auth/auth-screen';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { AUTH_PANEL_SLOT, siteMediaImage } from '@/lib/api/site-media';

// /forgot-password (plan Task 4) — quầy "lost ticket desk" của nhà ga.
export const metadata: Metadata = {
  title: messages.authForms.pages.forgotPassword.title,
  description: messages.authForms.pages.forgotPassword.description,
};

export default async function ForgotPasswordPage() {
  // Ảnh panel lấy ở TRANG (server component) rồi truyền xuống `AuthScreen` —
  // component đó là `'use client'` vì dùng motion, nên không tự fetch được.
  // Đây là quy ước đã ghi ở đầu `slot-image.tsx`, áp cho cả chín chỗ dùng khe.
  const image = await siteMediaImage(AUTH_PANEL_SLOT);

  return (
    <AuthScreen
      image={image}
      quote={messages.authForms.pages.forgotPassword.quote}
      author={messages.authForms.pages.forgotPassword.author}
    >
      <ForgotPasswordForm />
    </AuthScreen>
  );
}
