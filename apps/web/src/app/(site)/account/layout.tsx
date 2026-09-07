import type { Metadata } from 'next';

/**
 * Toàn khu /account KHÔNG được index (vòng vá review W3, ADR-0016 AMEND 2):
 * robots.txt đã disallow `/account/` nhưng chặn crawl thì crawler không đọc
 * được noindex — một link ngoài trỏ tới là URL vẫn lên SERP dạng title-only
 * (đúng anti-pattern comment ở lib/robots.ts lên án cho trang auth). Trước
 * đây 5/7 trang tự khai `robots: { index: false }` (thiếu follow) và hai
 * trang profile/security không khai gì — gom về một layout theo khuôn
 * `(auth)/layout.tsx`.
 *
 * Layout này CHỈ mang metadata — khung khu account nằm ở từng trang.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AccountLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
