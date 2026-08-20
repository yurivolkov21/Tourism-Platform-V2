'use client';

import { Button } from '@tourism/ui/components/button';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

/** Nút sign out của màn Not authorized — island nhỏ, xong về /login. */
export function SignOutButton({ label }: { label: string }) {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      onClick={async () => {
        await authClient.signOut();
        router.push('/login');
        router.refresh();
      }}
    >
      {label}
    </Button>
  );
}
