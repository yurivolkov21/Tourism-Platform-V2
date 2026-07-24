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
