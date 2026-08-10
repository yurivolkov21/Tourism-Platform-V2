import type { ReactNode } from 'react';
import { AccountNav } from '@/components/account/account-nav';

/**
 * Khung khu `/account` (spec 2026-08-04-account-area-design, pha A1 tĩnh) —
 * nav tab dùng chung 3 trang con (Trips/Saved/Profile).
 *
 * `pt-36` mượn ĐÚNG hằng số `ContentHero` dùng để né navbar `fixed`
 * (`site-header.tsx`: `fixed top-(--banner-offset)`, không có trang nào
 * chừa chỗ sẵn cho nó). Brief cấm dựng hero mới cho khu này — không có hero
 * ăn khoảng đó thì phải tự bù ở layout, thiếu bước này nội dung sẽ chui dưới
 * navbar khi cuộn lên đầu trang.
 *
 * KHÔNG gọi `requireSession`/`getServerSession` ở đây (đã có từ Task 1) — mỗi
 * TRANG con tự gọi riêng (Task 6, A2) để gate + fetch dữ liệu thật của chính
 * nó; đặt ở layout sẽ che một lỗi/trạng thái riêng của từng trang sau một
 * fetch chung.
 */
export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    // Padding NGANG phải giống hệt 52 chỗ còn lại của site và giống footer
    // (`site-footer.tsx`: `md:px-16 lg:px-24 xl:px-32` + `max-w-7xl`) — khu này
    // nằm ngay trên footer nên lệch một hằng số là nhìn thấy ngay.
    <div className="w-full px-4 pt-36 pb-16 md:px-16 md:pb-20 lg:px-24 xl:px-32">
      {/* `max-w-6xl` (1152) đổi thành `max-w-7xl` (1280): footer ngay dưới dùng
          7xl, nên từ 1536px trở lên nội dung account bị thụt 64px mỗi bên so
          với footer. Đây là lệch có thật, có từ trước, và không liên quan tới
          vòng thiết kế nào. */}
      <div className="mx-auto max-w-7xl">
        <AccountNav />
        <div className="mt-10">{children}</div>
      </div>
    </div>
  );
}
