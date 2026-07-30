import type { Metadata } from 'next';
import { Archivo, IBM_Plex_Mono, Literata } from 'next/font/google';
import { LenisScroll } from '@/components/lenis-scroll';
import { MotionProvider } from '@/components/motion/motion-provider';
import './globals.css';

// Bộ font chốt qua 2 vòng specimen (ADR-0013 #6, cập nhật 22/07): Literata
// (heading serif) + Archivo (thân/UI grotesque) + IBM Plex Mono (mã đặt chỗ,
// số kỹ thuật). Cả ba có subset vietnamese — địa danh đủ dấu ở mọi vai trò.
const sans = Archivo({
  variable: '--font-sans',
  subsets: ['latin', 'vietnamese'],
});

const heading = Literata({
  variable: '--font-heading',
  subsets: ['latin', 'vietnamese'],
  // Nạp thêm italic thật — dòng accent của CTA (#25) dùng nghiêng; thiếu là
  // trình duyệt tự nghiêng giả (faux italic), mất nét thư pháp của Literata.
  style: ['normal', 'italic'],
});

const mono = IBM_Plex_Mono({
  variable: '--font-mono',
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: 'Tourism',
  description: 'Book tours across Vietnam',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sans.variable} ${heading.variable} ${mono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* Áp theme đã lưu TRƯỚC paint đầu (đọc localStorage của
            AnimatedThemeToggler, fallback theo hệ) — không có script này thì
            trang dark bị chớp trắng mỗi lần tải lại. Chạy trước hydrate nên
            html cần suppressHydrationWarning. */}
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: script tĩnh nội bộ, không có input người dùng
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
        {/* Lưới an toàn cho trường hợp JS chết trên trang SSG.

            `motion` render prop `initial` thành `style` inline NGAY TRONG HTML của
            server, nên một khu khai `initial={{ opacity: 0 }}` cộng `whileInView` sẽ
            **ẩn vĩnh viễn** nếu JS không chạy — observer không bao giờ bắn thì không có
            gì tháo `opacity:0` ra. Mọi trang của site này là SSG, tức HTML đó là thứ
            crawler và người dùng no-JS nhận được.
            Đo trên `/destinations/northern-vietnam` (30/07): **15 phần tử** mang
            `style="opacity:0…"` trong HTML server — 13 ở hero, 5 ở eyebrow khu, phần
            còn lại ở footer. Không có JS thì đó là 15 mảng nội dung trắng trơn.
            Vì sao vá ở TẦNG NÀY chứ không sửa từng component: `initial` là cách duy
            nhất motion biết điểm bắt đầu của một nhịp, nên bỏ nó đi là bỏ luôn chuyển
            động đã duyệt ở 40+ chỗ. Một rule trong `<noscript>` thì **không tồn tại
            khi JS bật** — nó không phát sinh CSS, không đụng specificity, không đổi một
            pixel nào của bản đã duyệt — và khi JS tắt thì nó tháo cả `opacity` lẫn
            `transform` để chữ vừa hiện vừa đứng đúng vị trí.
            Đặt trong `<head>`: `<noscript>` ở head CHỈ được chứa `link`/`style`/`meta`
            theo HTML5, và `style` nằm trong danh sách đó — nên đây là chỗ hợp lệ, và
            rule tới trước lúc trang vẽ chứ không nhảy sau.
            ⚠️ KHÔNG có test Vitest nào canh cái này: project `node` không quét
            `app/**`, và jsdom không hiện thực `<noscript>`. Chốt duy nhất là phép đo
            bằng `browser.newContext({ javaScriptEnabled: false })`. */}
        <noscript>
          <style
            // biome-ignore lint/security/noDangerouslySetInnerHtml: CSS tĩnh nội bộ, không có input người dùng
            dangerouslySetInnerHTML={{
              __html: '[style*="opacity:0"]{opacity:1!important;transform:none!important}',
            }}
          />
        </noscript>
      </head>
      <body className="min-h-full flex flex-col">
        {/* Shell TopBar/navbar/footer đã dời xuống (site)/layout.tsx — root chỉ
            còn provider toàn cục để cụm (auth) có màn hình riêng (plan auth) */}
        <MotionProvider>
          <LenisScroll />
          {children}
        </MotionProvider>
      </body>
    </html>
  );
}
