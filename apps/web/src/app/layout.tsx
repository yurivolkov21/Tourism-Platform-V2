import type { Metadata } from 'next';
import { Be_Vietnam_Pro, Geist_Mono, Lora } from 'next/font/google';
import './globals.css';

// Font brand (ADR-0013 #6): Be Vietnam Pro (thân/UI) + Lora (heading) — cả hai
// có subset vietnamese cho địa danh; Geist Mono giữ cho code/kbd.
const sans = Be_Vietnam_Pro({
  variable: '--font-sans',
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
});

const heading = Lora({
  variable: '--font-heading',
  subsets: ['latin', 'vietnamese'],
});

const mono = Geist_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
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
