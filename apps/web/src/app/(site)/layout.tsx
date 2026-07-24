import { ScrollToTop } from '@/components/scroll-to-top';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { TopBar } from '@/components/top-bar';

// Shell chung cho các trang "site" (Home/About/Contact...) — dời từ root
// layout xuống route group (site) để cụm (auth) có màn hình riêng không
// TopBar/navbar/footer (plan auth Task 1). Route group không đổi URL.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopBar />
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
      <ScrollToTop />
    </>
  );
}
