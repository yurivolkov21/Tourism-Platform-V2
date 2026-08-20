import { VerifyEmailBanner } from '@/components/auth/verify-email-banner';
import { ScrollToTop } from '@/components/scroll-to-top';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { TopBar } from '@/components/top-bar';

// Chrome chung của site. Tách khỏi (site)/layout.tsx vì app/not-found.tsx —
// trang bắt URL không khớp — chỉ render trong ROOT layout, không đi qua layout
// của route group, nên nếu không dùng lại khối này thì 404 sẽ trần trụi
// không navbar/footer. error.tsx và global-error.tsx CỐ Ý không dùng: chúng
// phải sống được cả khi cây trang đã hỏng.
export function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar />
      {/* Dải verify cho session CŨ chưa xác thực (siết 20/08) — thường null. */}
      <VerifyEmailBanner />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <ScrollToTop />
    </>
  );
}
