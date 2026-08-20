import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/login-form';
import { LoginWaves } from '@/components/auth/login-waves';
import { Logo } from '@/components/logo';

const t = messages.admin.login;
const SITE_URL = 'https://www.nexora-travel.agency';

/**
 * Trang login admin — wireframe bám ReUI auth-8 (vòng 2, mockup:
 * docs/design/mockups/admin-login/reui-auth8-*): topbar logo trái + pill
 * hành động phải · card ĐẶC giữa màn (khung muted bọc card trắng — input
 * hết xuyên thấu, đúng góp ý vòng 1) · caption tagline dưới card.
 *
 * Khác mẫu có chủ đích (đã chốt từ vòng 1): nền TRẮNG TRƠN thay ảnh mờ —
 * user chọn animation gradient-waves (React Bits) lắp vòng sau vào lớp nền;
 * bỏ social login + "Create an account" (admin không có hai flow đó) — pill
 * header + footer card thay bằng đường về site khách.
 */
export default function LoginPage() {
  return (
    <main className="relative flex min-h-svh w-full flex-col overflow-hidden bg-background">
      {/* Nền GradientWaves (React Bits, WebGL) — màu token, mức BOLD user chấm. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <LoginWaves />
      </div>

      {/* Topbar theo mẫu: mark + wordmark trái · pill hành động phải. */}
      <header className="relative z-20 flex w-full items-center justify-between px-6 py-5">
        {/* Mark "Slidex" + wordmark — cùng Logo với web (user nhắc 20/08). */}
        {/* Cỡ mặc định + mark nới h-7 — user góp ý 20/08: logo topbar quá nhỏ. */}
        <Logo className="[&>svg]:h-7" />
        <div className="flex items-center gap-2 rounded-full bg-muted/60 py-1.5 pr-1.5 pl-4 text-sm text-muted-foreground ring-1 ring-border/40">
          <span className="hidden sm:inline">{t.lookingForSite}</span>
          {/* ButtonLink chứ không phải Button render=<a>: giữ role link thật
              (JSDoc button-link.tsx — Base UI ép role button lên anchor). */}
          <ButtonLink size="sm" variant="outline" className="rounded-full" href={SITE_URL}>
            {t.visitSite}
          </ButtonLink>
        </div>
      </header>

      {/* Card đặc giữa màn: khung muted bọc card trắng, đúng giải phẫu mẫu. */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-6 pb-12">
        <div className="flex w-full max-w-md flex-col items-center gap-6">
          <div className="w-full rounded-3xl bg-muted/50 p-1.5">
            <div className="rounded-2xl border border-border/40 bg-card px-8 py-9 shadow-sm">
              <div className="mb-6 text-center">
                <h1 className="font-heading text-2xl font-semibold tracking-tight">{t.title}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
              </div>
              <Suspense fallback={null}>
                <LoginForm />
              </Suspense>
            </div>
          </div>
          {/* Caption dưới card — vị trí của "Joining 14,000+…" trong mẫu. */}
          <p className="max-w-sm text-balance text-center text-xs font-medium text-muted-foreground">
            {`${messages.brand.name} — ${messages.brand.tagline}`}
          </p>
        </div>
      </div>
    </main>
  );
}
