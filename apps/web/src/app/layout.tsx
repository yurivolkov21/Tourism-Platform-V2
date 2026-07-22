import type { Metadata } from 'next';
import { Archivo, IBM_Plex_Mono, Literata } from 'next/font/google';
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
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
