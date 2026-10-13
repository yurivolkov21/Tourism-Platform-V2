import { messages } from '@tourism/i18n';
import { buttonVariants } from '@tourism/ui/components/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@tourism/ui/components/card';
import Link from 'next/link';
import { connection } from 'next/server';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { notAuthorizedVariant } from '@/lib/admin-gate';
import { getServerSession } from '@/lib/api/session';
import { webUrl } from '@/lib/site';

const t = messages.admin.notAuthorized;

/**
 * Màn từ chối quyền (spec P4a §2): tài khoản THẬT nhưng không phải ADMIN —
 * nói rõ thay vì im lặng, kèm đường thoát (sign out / về site khách). Từ P4f
 * (ADR-0052) Staff cũng tới đây khi mở một trang chỉ Owner — họ nhận câu riêng
 * và đường về dashboard, không phải lời mời đăng xuất.
 */
export default async function NotAuthorizedPage() {
  // Ép render động (W3-H2): trang tĩnh không nhận nonce → SignOutButton bị
  // CSP chặn script ở production. Cùng lý do với login/page.tsx.
  await connection();
  // Nói theo role (plan P4f, quyết định 5): Staff tới đây vì một trang chỉ Owner.
  const session = await getServerSession();
  if (notAuthorizedVariant(session?.role ?? null) === 'ownerOnly') {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background px-4">
        <Card className="w-full max-w-sm">
          <CardHeader>
            <CardTitle className="font-heading text-xl">{t.ownerOnly.title}</CardTitle>
            <CardDescription>{t.ownerOnly.body}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Link href="/" className={buttonVariants()}>
              {t.ownerOnly.back}
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-heading text-xl">{t.title}</CardTitle>
          <CardDescription>{t.body}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <SignOutButton label={t.signOut} />
          <a href={webUrl()} className="text-center text-sm text-muted-foreground underline">
            {t.backToSite}
          </a>
        </CardContent>
      </Card>
    </main>
  );
}
