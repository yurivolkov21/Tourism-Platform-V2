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
    // KHÔNG có script gắn `.dark` theo OS/localStorage như web (gỡ ở vòng vá
    // review 02/09): admin chỉ có MỘT diện mạo cố định (ADR-0027, user chốt
    // 01/09) và không có toggle theme nào. Giữ script thì `.dark` (48 token)
    // rò qua lớp đè `[data-admin-surface]` (~23 token) trên máy để dark mode —
    // nền bị ép sáng còn chữ accent/secondary vẫn gần trắng.
    <html
      lang="en"
      className={`${sans.variable} ${heading.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        {children}
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
