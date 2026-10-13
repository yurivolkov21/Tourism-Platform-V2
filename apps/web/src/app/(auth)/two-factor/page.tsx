import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { AuthScreen } from '@/components/auth/auth-screen';
import { TwoFactorForm } from '@/components/auth/two-factor-form';
import { AUTH_PANEL_SLOT, siteMediaImage } from '@/lib/api/site-media';

// PARK theo ADR-0017 §5b — API chưa bật plugin twoFactor, trang giữ TĨNH làm
// UI dự phòng (nợ có kế hoạch, không nối API ở Task 5 này).
export const metadata: Metadata = {
  title: messages.authForms.pages.twoFactor.title,
  description: messages.authForms.pages.twoFactor.description,
};

export default async function TwoFactorPage() {
  // Ảnh panel lấy ở TRANG (server component) rồi truyền xuống `AuthScreen` —
  // component đó là `'use client'` vì dùng motion, nên không tự fetch được.
  // Đây là quy ước đã ghi ở đầu `slot-image.tsx`, áp cho cả chín chỗ dùng khe.
  const image = await siteMediaImage(AUTH_PANEL_SLOT);

  return (
    <AuthScreen
      image={image}
      quote={messages.authForms.pages.twoFactor.quote}
      author={messages.authForms.pages.twoFactor.author}
    >
      <TwoFactorForm />
    </AuthScreen>
  );
}
