import type { ReactNode } from 'react';

/**
 * Khung khu `/account` thời Hộ chiếu (spec 2026-08-11 + góp ý user 11/08):
 *
 * 1. **Bìa hộ chiếu**: dải `bg-hero` tối trên cùng — navbar đứng trên nền tối
 *    với chữ `on-media` y như mọi trang có hero, KHÔNG cần biến thể navbar
 *    riêng nữa (đã gỡ `/account` khỏi `HERO_LESS_PREFIXES`). Chiều cao đủ để
 *    né navbar `fixed` (thay vai trò `pt-36` cũ) và cho cảm giác "mở bìa ra
 *    thấy trang giấy".
 * 2. **Giấy phủ TRỌN khu**: `bg-paper` nằm ở đây, không phải từng trang — mọi
 *    trang con là "ruột hộ chiếu", trang ngắn không còn lộ khoảng nền trắng
 *    vô nghĩa trước footer (góp ý user).
 *
 * KHÔNG gọi `requireSession`/`getServerSession` ở đây — mỗi trang con tự gate
 * + fetch dữ liệu của chính nó (quyết định từ cụm A, lý do cũ vẫn đúng).
 */
export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div className="w-full bg-paper">
      {/* Bìa: chỉ là mảng màu — mọi chữ/danh tính nằm ở trang giấy bên dưới.
          `h-40` ≈ vùng navbar (pt-36 cũ) + một hơi thở mép bìa. */}
      <div aria-hidden="true" className="h-40 w-full bg-hero" />
      <div className="relative pb-16 md:pb-20">
        {/* Texture giấy MỘT nguồn cho cả khu (trước đây mỗi trang tự phủ) —
            kẻ ngang mờ bằng lớp ink + mask, tokens-only. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-ink/[0.04] [mask-image:repeating-linear-gradient(0deg,transparent_0_3px,black_3px_4px)]"
        />
        <div className="relative">{children}</div>
      </div>
    </div>
  );
}
