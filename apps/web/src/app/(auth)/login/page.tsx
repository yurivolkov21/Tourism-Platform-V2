import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthScreen } from '@/components/auth/auth-screen';
import { LoginForm } from '@/components/auth/login-form';
import { AUTH_PANEL_SLOT, siteMediaImage } from '@/lib/api/site-media';

// /login — trang MẪU của cụm auth (spec/plan 2026-07-24): AuthScreen split +
// TicketCard. Duyệt layout ở trang này xong mới nhân ra 5 trang còn lại.
export const metadata: Metadata = {
  title: 'Log in — Tourism',
  description: 'Log in to pick up where the map left off.',
};

export default async function LoginPage() {
  // Ảnh panel lấy ở TRANG (server component) rồi truyền xuống `AuthScreen` —
  // component đó là `'use client'` vì dùng motion, nên không tự fetch được.
  // Đây là quy ước đã ghi ở đầu `slot-image.tsx`, áp cho cả chín chỗ dùng khe.
  const image = await siteMediaImage(AUTH_PANEL_SLOT);

  return (
    <AuthScreen
      image={image}
      quote="Welcome back — the valley kept your seat."
      author="Mai, Sa Pa guide"
    >
      {/* Task 3 (auth-pages-api): LoginForm đọc `redirect` qua useSearchParams
          (Better Auth safe-redirect) — Next 16 bắt buộc bọc Suspense quanh
          client component dùng hook này, không thì `next build` gãy ngay ở
          bước prerender static (đo được: lỗi "should be wrapped in a
          suspense boundary" tại /login). Fallback null: hydrate gần như tức
          thời nên không gây layout shift thấy được. */}
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthScreen>
  );
}
