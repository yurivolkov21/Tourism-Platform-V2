import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { AccountDashboard } from '@/components/account/account-dashboard';
import { DASHBOARD_BOOKINGS_LIMIT, fetchMyBookings } from '@/lib/api/bookings';
import { requireSession } from '@/lib/api/session';
import { fetchMyWishlist } from '@/lib/api/wishlist';

/**
 * `/account` — dashboard (spec §3, Task 6/A2: session + dữ liệu THẬT thay
 * mock nội bộ cụm đã khai tử). Tiêu đề + lời chào đặt Ở TRANG (không phải
 * trong `AccountDashboard`) — cùng khuôn `/account/saved` (page tự render
 * `<h1>`, component chỉ lo phần thân).
 *
 * `robots: { index: false }` — trang per-user, không có giá trị index, cùng
 * lý do các trang `/account/*` khác và `/newsletter/unsubscribe`.
 */
export const metadata: Metadata = {
  title: `${messages.accountDashboard.title} — Tourism`,
  robots: { index: false },
};

/**
 * Gate bằng `requireSession` (defense-in-depth, `proxy.ts` đã chặn sớm —
 * ADR-0017 §3) rồi fetch song song bookings + wishlist bằng CÙNG cookie
 * forward. `bookings` lấy tới `DASHBOARD_BOOKINGS_LIMIT` (KHÔNG phải một
 * trang) vì `AccountDashboard` tự tính 4 ô số/nextTrip/5-upcoming từ TOÀN BỘ
 * danh sách (xem comment `dashboardStats`/`nextTrip` ở `account-stats.ts`) —
 * khác `/account/bookings` (list đầy đủ có "Load more" riêng, đọc từ cùng
 * `bookings.ts` nhưng limit theo `?page=`).
 */
export default async function AccountDashboardPage() {
  const user = await requireSession('/account');
  const cookie = (await cookies()).toString();
  const [bookingsPage, wishlist] = await Promise.all([
    fetchMyBookings(cookie, DASHBOARD_BOOKINGS_LIMIT),
    fetchMyWishlist(cookie),
  ]);

  const t = messages.accountDashboard;
  return (
    <div>
      <h1 className="font-heading text-2xl font-medium text-balance text-foreground">{t.title}</h1>
      <p className="mt-2 text-muted-foreground">{t.greeting(user.name)}</p>
      <div className="mt-2">
        <AccountDashboard bookings={bookingsPage.items} wishlist={wishlist} />
      </div>
    </div>
  );
}
