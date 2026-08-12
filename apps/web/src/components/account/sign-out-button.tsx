'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';

/**
 * Nút Sign out trong cụm action của khung hộ chiếu (góp ý user 12/08) —
 * đứng cạnh My bookings/Saved tours/Settings. Tách thành client component
 * vì trang passport là RSC còn sign-out phải chạy CLIENT-SIDE (store Better
 * Auth cập nhật navbar ngay, không đợi full reload — ADR-0017 §2, cùng
 * logic với menu avatar).
 */
export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    setPending(true);
    try {
      await authClient.signOut();
      router.push('/');
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={handleSignOut}>
      {messages.passportHome.signOutLink}
    </Button>
  );
}
