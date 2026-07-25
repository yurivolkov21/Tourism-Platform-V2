import type { Metadata } from 'next';
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
      author="Đức Anh, co-founder"
    >
      <RegisterForm />
    </AuthScreen>
  );
}
