import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { AccountDashboard } from '@/components/account/account-dashboard';
import { MOCK_BOOKINGS, MOCK_PROFILE, MOCK_WISHLIST } from '@/mocks/account';

/**
 * `/account` — dashboard (spec §3, pha A1 TĨNH). Đọc trực tiếp mock nội bộ
 * cụm (`@/mocks/account`), KHÔNG gọi `requireSession`/API — wire session +
 * dữ liệu thật là việc Task 6 (A2), lúc đó thay đúng các dòng import mock
 * bằng session/fetch thật, phần còn lại của trang/`AccountDashboard` không
 * đổi. Tiêu đề + lời chào đặt Ở TRANG (không phải trong `AccountDashboard`)
 * — cùng khuôn `/account/saved` (page tự render `<h1>`, component chỉ lo phần
 * thân), và `MOCK_PROFILE.name` chỉ dùng đúng một chỗ này trong Task 3.
 *
 * `robots: { index: false }` — trang per-user, không có giá trị index, cùng
 * lý do các trang `/account/*` khác và `/newsletter/unsubscribe`.
 */
export const metadata: Metadata = {
  title: `${messages.accountDashboard.title} — Tourism`,
  robots: { index: false },
};

export default function AccountDashboardPage() {
  const t = messages.accountDashboard;
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="font-heading text-2xl font-medium text-balance text-foreground">
          {t.title}
        </h1>
        <p className="mt-2 text-muted-foreground">{t.greeting(MOCK_PROFILE.name)}</p>
      </div>
      <AccountDashboard bookings={MOCK_BOOKINGS} wishlist={MOCK_WISHLIST} />
    </div>
  );
}
