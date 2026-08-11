import type { ReactNode } from 'react';

/**
 * Khung khu `/account` thời Hộ chiếu (spec 2026-08-11): KHÔNG còn nav tab —
 * trang hộ chiếu là cửa duy nhất, điều hướng nội khu bằng link trong trang
 * (⚙ Settings, Open → của ngăn Saved, back-link "← Passport").
 *
 * Layout chỉ còn hai việc: (1) `pt-36` né navbar `fixed` (hằng số mượn từ
 * `ContentHero` — xem `site-header.tsx`, không trang nào được chừa chỗ sẵn);
 * (2) KHÔNG ép container/padding ngang nữa — từng trang tự quản, để section
 * giấy (`bg-paper`) bleed hết bề ngang viewport rồi tự giới hạn nội dung bên
 * trong (`max-w-5xl` + padding của chính nó).
 *
 * KHÔNG gọi `requireSession`/`getServerSession` ở đây — mỗi trang con tự gate
 * + fetch dữ liệu của chính nó (giữ nguyên quyết định từ cụm A, lý do cũ vẫn
 * đúng: gate ở layout sẽ che trạng thái riêng của từng trang).
 */
export default function AccountLayout({ children }: { children: ReactNode }) {
  return <div className="w-full pt-36 pb-16 md:pb-20">{children}</div>;
}
