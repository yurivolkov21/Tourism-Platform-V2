import { messages } from '@tourism/i18n';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@tourism/ui/components/card';
import { connection } from 'next/server';
import { SignOutButton } from '@/components/auth/sign-out-button';

const t = messages.admin.notAuthorized;
const SITE_URL = 'https://www.nexora-travel.agency';

/**
 * Màn từ chối quyền (spec P4a §2): tài khoản THẬT nhưng không phải ADMIN —
 * nói rõ thay vì im lặng, kèm đường thoát (sign out / về site khách).
 */
export default async function NotAuthorizedPage() {
  // Ép render động (W3-H2): trang tĩnh không nhận nonce → SignOutButton bị
  // CSP chặn script ở production. Cùng lý do với login/page.tsx.
  await connection();
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-heading text-xl">{t.title}</CardTitle>
          <CardDescription>{t.body}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <SignOutButton label={t.signOut} />
          <a href={SITE_URL} className="text-center text-sm text-muted-foreground underline">
            {t.backToSite}
          </a>
        </CardContent>
      </Card>
    </main>
  );
}
