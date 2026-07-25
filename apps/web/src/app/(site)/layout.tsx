import { SiteChrome } from '@/components/site-chrome';

// Shell chung cho các trang "site" (Home/About/Contact/pháp lý...) — dời từ
// root layout xuống route group (site) để cụm (auth) có màn hình riêng không
// TopBar/navbar/footer (plan auth Task 1). Route group không đổi URL.
// Ruột chrome nằm trong SiteChrome để app/not-found.tsx dùng lại được: trang
// 404 của URL không khớp KHÔNG đi qua layout của route group.
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return <SiteChrome>{children}</SiteChrome>;
}
