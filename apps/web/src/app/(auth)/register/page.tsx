import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthScreen } from '@/components/auth/auth-screen';
import { RegisterForm } from '@/components/auth/register-form';
import { AUTH_PANEL_SLOT, siteMediaImage } from '@/lib/api/site-media';

// /register (plan Task 3) — quote "minivan 2014" bám chuyện sáng lập ở /about.
export const metadata: Metadata = {
  title: 'Create an account — Nexora',
  description: 'One account for every valley, coast and city ahead.',
};

export default async function RegisterPage() {
  // Ảnh panel lấy ở TRANG (server component) rồi truyền xuống `AuthScreen` —
  // component đó là `'use client'` vì dùng motion, nên không tự fetch được.
  // Đây là quy ước đã ghi ở đầu `slot-image.tsx`, áp cho cả chín chỗ dùng khe.
  const image = await siteMediaImage(AUTH_PANEL_SLOT);

  return (
    <AuthScreen
      image={image}
      quote="In 2014 this was three friends and one rented minivan. There is always room for one more."
      author="Giang Tử Dương, co-founder"
    >
      {/* Cùng lý do Suspense với /login: RegisterForm cũng đọc `redirect` qua
          useSearchParams (nút Google) — xem ghi chú đầy đủ ở login/page.tsx. */}
      <Suspense fallback={null}>
        <RegisterForm />
      </Suspense>
    </AuthScreen>
  );
}
