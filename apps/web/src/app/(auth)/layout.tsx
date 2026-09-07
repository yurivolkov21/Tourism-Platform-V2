import type { Metadata } from 'next';

/**
 * Sáu trang auth (login/register/forgot/reset/verify/two-factor) KHÔNG được
 * index (ADR-0016 AMEND 1 §7 — audit cụm 7: `/reset-password?token=…`,
 * `/verify-email?email=…` index được là rò token/email qua SERP). Noindex
 * bằng metadata chứ KHÔNG disallow ở robots.txt: chặn crawl thì crawler
 * không đọc được noindex, và trang bị chặn vẫn có thể lên kết quả tìm kiếm
 * nếu nơi khác trỏ tới (comment gốc ở lib/robots.ts).
 *
 * Layout này CHỈ mang metadata — mọi khung hình của cụm auth vẫn nằm ở từng
 * trang (TicketCard/AuthScreen), đừng thêm markup vào đây.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
