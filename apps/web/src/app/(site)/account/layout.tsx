import type { ReactNode } from 'react';
import { AccountNav } from '@/components/account/account-nav';

/**
 * Khung khu `/account` (spec 2026-08-04-account-area-design, pha A1 tĩnh) —
 * nav tab dùng chung 4 trang con (dashboard/bookings/saved/profile).
 *
 * `pt-36` mượn ĐÚNG hằng số `ContentHero` dùng để né navbar `fixed`
 * (`site-header.tsx`: `fixed top-(--banner-offset)`, không có trang nào
 * chừa chỗ sẵn cho nó). Brief cấm dựng hero mới cho khu này — không có hero
 * ăn khoảng đó thì phải tự bù ở layout, thiếu bước này nội dung sẽ chui dưới
 * navbar khi cuộn lên đầu trang.
 *
 * KHÔNG gọi `requireSession`/`getServerSession` ở đây (đã có từ Task 1) — pha
 * A1 mọi trang con tự đọc mock trực tiếp (`@/mocks/account`); wire session
 * thật là việc Task 6 (A2), mỗi TRANG tự gọi lúc đó — đặt ở layout sẽ che một
 * lỗi/trạng thái riêng của từng trang sau một fetch chung.
 */
export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div className="w-full px-4 pt-36 pb-16 md:px-16 md:pb-20 lg:px-24 xl:px-32">
      <div className="mx-auto max-w-6xl">
        <AccountNav />
        <div className="mt-8">{children}</div>
      </div>
    </div>
  );
}
