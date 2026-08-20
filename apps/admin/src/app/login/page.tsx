import { messages } from '@tourism/i18n';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@tourism/ui/components/card';
import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/login-form';

const t = messages.admin.login;
const SITE_URL = 'https://www.nexora-travel.agency';

// Suspense: LoginForm dùng useSearchParams (redirect param) — Next đòi ranh
// giới suspense cho hook đó ở trang prerender.
export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="font-heading text-xl">
            nex<span className="text-primary-emphasis">ora</span>
            <span className="ml-2 text-sm font-normal text-muted-foreground">back office</span>
          </CardTitle>
          <CardDescription>{t.subtitle}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
          <a href={SITE_URL} className="text-center text-sm text-muted-foreground underline">
            {t.backToSite}
          </a>
        </CardContent>
      </Card>
    </main>
  );
}
