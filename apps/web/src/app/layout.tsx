import type { Metadata } from 'next';
import { Archivo, IBM_Plex_Mono, Literata } from 'next/font/google';
import { LenisScroll } from '@/components/lenis-scroll';
import { MotionProvider } from '@/components/motion/motion-provider';
import { SiteFooter } from '@/components/site-footer';
import { SiteHeader } from '@/components/site-header';
import { TopBar } from '@/components/top-bar';
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
    >
      <body className="min-h-full flex flex-col">
        <MotionProvider>
          <LenisScroll />
          <TopBar />
          <SiteHeader />
          <main className="flex-1">{children}</main>
          <SiteFooter />
        </MotionProvider>
      </body>
    </html>
  );
}
