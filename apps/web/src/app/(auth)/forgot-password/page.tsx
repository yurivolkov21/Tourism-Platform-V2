import type { Metadata } from 'next';
import { AuthScreen } from '@/components/auth/auth-screen';
import { ForgotPasswordForm } from '@/components/auth/forgot-password-form';
import { AUTH_PANEL_SLOT, siteMediaImage } from '@/lib/api/site-media';

// /forgot-password (plan Task 4) — quầy "lost ticket desk" của nhà ga.
export const metadata: Metadata = {
  title: 'Forgot password — Tourism',
  description: 'Tell us your email and we will send a reset link.',
};

export default async function ForgotPasswordPage() {
  // Ảnh panel lấy ở TRANG (server component) rồi truyền xuống `AuthScreen` —
  // component đó là `'use client'` vì dùng motion, nên không tự fetch được.
  // Đây là quy ước đã ghi ở đầu `slot-image.tsx`, áp cho cả chín chỗ dùng khe.
  const image = await siteMediaImage(AUTH_PANEL_SLOT);

  return (
    <AuthScreen
      image={image}
      quote="Losing the trail is part of the trek. A guide walks you back."
      author="Mạnh Duy An, Head of Guides"
    >
      <ForgotPasswordForm />
    </AuthScreen>
  );
}
