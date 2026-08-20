import { Toaster } from '@tourism/ui/components/sonner';
import type { Metadata } from 'next';
import { Archivo, IBM_Plex_Mono, Literata } from 'next/font/google';
import './globals.css';

// Cùng bộ font đã chốt của web (ADR-0013 #6) — admin không mở hệ thẩm mỹ
// mới (ADR-0026 §3): Literata (heading) + Archivo (thân/UI) + IBM Plex Mono
// (mã booking, số kỹ thuật — back-office dùng nhiều).
const sans = Archivo({
  variable: '--font-sans',
  subsets: ['latin', 'vietnamese'],
});

const heading = Literata({
  variable: '--font-heading',
  subsets: ['latin', 'vietnamese'],
});

const mono = IBM_Plex_Mono({
  variable: '--font-mono',
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: 'Nexora back office',
  description: 'Internal back office for the Nexora travel platform',
  // Back-office KHÔNG cho index — dù prod có auth gate, đừng để lộ cả URL.
  robots: { index: false, follow: false },
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
        {/* Áp theme đã lưu TRƯỚC paint đầu (cùng script với web) — không có
            thì trang dark chớp trắng mỗi lần tải. */}
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: script tĩnh nội bộ, không có input người dùng
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-full bg-background text-foreground">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
