import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthScreen } from '@/components/auth/auth-screen';
import { RegisterForm } from '@/components/auth/register-form';

// /register (plan Task 3) — quote "minivan 2014" bám chuyện sáng lập ở /about.
export const metadata: Metadata = {
  title: 'Create an account — Tourism',
  description: 'One account for every valley, coast and city ahead.',
};

export default function RegisterPage() {
  return (
    <AuthScreen
      quote="In 2014 this was four friends and one rented minivan. There is always room for one more."
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
