import type { Booking, WishlistItem } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import Link from 'next/link';
import { UnavailableCard } from '@/components/account/saved-grid';
import { TourCard } from '@/components/tours/tour-card';
import { dashboardStats, nextTrip, upcomingBookings } from '@/lib/account-stats';
import { type BookingViewTone, bookingView } from '@/lib/booking-vm';
import { formatMoney } from '@/lib/tours';
import { wishlistToTourCardVM } from '@/lib/wishlist-vm';

/** 5 booking sắp tới trên dashboard (spec §3), 3 tour đã lưu — hai giới hạn
 *  ĐỘC LẬP với `/account/bookings`/`/account/saved` (list đủ, dashboard chỉ
 *  là bản trích ngắn). */
const UPCOMING_LIMIT = 5;
const SAVED_PREVIEW_LIMIT = 3;

/** Badge trạng thái booking — cùng tông `bookingView` (Task 2) đang dùng cho
 *  hành động ở trang chi tiết, token-only (spec §3 "badge tone theo status").
 *  Export để `booking-card.tsx`/trang `/account/bookings` (Task 4) tái dùng
 *  NGUYÊN — một nguồn map tone→class, không có bản sao thứ hai trong cụm. */
export const TONE_CLASS: Record<BookingViewTone, string> = {
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  muted: 'bg-muted text-muted-foreground',
  destructive: 'bg-destructive/10 text-destructive',
};

function EmptyState() {
  const t = messages.accountDashboard.emptyState;
  return (
    <div className="rounded-2xl border bg-card p-10 text-center">
      <h2 className="font-heading text-2xl font-medium text-balance text-foreground">
        {t.heading}
      </h2>
      <p className="mt-3 text-pretty text-muted-foreground">{t.body}</p>
      <ButtonLink href="/tours" className="mt-6">
        {t.cta}
      </ButtonLink>
    </div>
  );
}

/**
 * Dashboard `/account` (spec §3, pha A1 tĩnh) — 4 ô số · thẻ "chuyến kế
 * tiếp" · 5 booking sắp tới · 3 tour đã lưu · empty tổng → CTA `/tours`.
 * Tự tính VM từ `bookings`/`wishlist` THÔ (dùng nguyên hàm thuần Task 2/3
 * `@/lib/account-stats`) thay vì nhận VM đã tính sẵn từ page — để trang A2
 * (Task 6) chỉ cần đổi NGUỒN mảng (API thay mock), không phải viết lại chỗ
 * tính VM này.
 */
export function AccountDashboard({
  bookings,
  wishlist,
}: {
  bookings: Booking[];
  wishlist: WishlistItem[];
}) {
  const t = messages.accountDashboard;

  // "Empty tổng" (spec §3) = KHÔNG một booking nào, KHÔNG một tour đã lưu
  // nào — khác hẳn "upcoming rỗng"/"saved rỗng" riêng lẻ (vẫn có dữ liệu ở
  // nhánh khác, chỉ hiện text rỗng cho ĐÚNG khối đó, không đổi cả trang).
  if (bookings.length === 0 && wishlist.length === 0) {
    return <EmptyState />;
  }

  const stats = dashboardStats(bookings, wishlist.length);
  const trip = nextTrip(bookings);
  const upcoming = upcomingBookings(bookings, UPCOMING_LIMIT);
  const savedPreview = wishlist.slice(0, SAVED_PREVIEW_LIMIT);

  return (
    <div className="flex flex-col gap-10">
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {(['trips', 'upcoming', 'completed', 'saved'] as const).map((key) => (
          <div key={key} className="rounded-2xl border bg-card p-5">
            <dt className="text-sm text-muted-foreground">{t.stats[key]}</dt>
            <dd className="mt-1 font-heading text-3xl font-semibold tabular-nums text-foreground">
              {stats[key]}
            </dd>
          </div>
        ))}
      </dl>

      {trip ? (
        <section className="rounded-2xl border bg-card p-6">
          <h2 className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
            {t.nextTrip.heading}
          </h2>
          <p className="mt-2 font-heading text-xl font-medium text-foreground">{trip.tourTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.nextTrip.departing(trip.departureStartDate)}
          </p>
        </section>
      ) : null}

      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-medium text-foreground">{t.upcoming.heading}</h2>
          <Link href="/account/bookings" className="text-sm text-primary hover:underline">
            {t.upcoming.viewAll}
          </Link>
        </div>
        {upcoming.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{t.upcoming.empty}</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {upcoming.map((booking) => {
              const view = bookingView(booking);
              return (
                <li key={booking.id}>
                  <Link
                    href={`/account/bookings/${booking.code}`}
                    className="flex items-center justify-between gap-4 rounded-xl border p-4 transition-colors hover:border-primary/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{booking.tourTitle}</p>
                      <p className="text-sm text-muted-foreground">
                        {booking.departureStartDate} ·{' '}
                        {formatMoney(booking.totalAmount, booking.currency)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASS[view.tone]}`}
                    >
                      {/* Nguồn label status DUY NHẤT: `booking.list.status` — cùng
                          khối i18n Task 4 (trang /account/bookings) dùng, tránh
                          drift chuỗi giữa hai nơi hiện cùng một enum. */}
                      {messages.booking.list.status[booking.status]}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-medium text-foreground">{t.saved.heading}</h2>
          <Link href="/account/saved" className="text-sm text-primary hover:underline">
            {t.saved.viewAll}
          </Link>
        </div>
        {savedPreview.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{t.saved.empty}</p>
        ) : (
          <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {savedPreview.map((item) =>
              // Tour đã unpublish sau khi khách lưu → dùng lại UnavailableCard
              // của saved-grid.tsx (KHÔNG có nút bỏ lưu ở đây, chỉ là preview)
              // thay vì TourCard trần — TourCard luôn link tới /tours/[slug],
              // link đó chết với tour đã gỡ.
              item.unavailable ? (
                <UnavailableCard key={item.tourId} item={item} />
              ) : (
                <TourCard key={item.tourId} tour={wishlistToTourCardVM(item)} />
              ),
            )}
          </div>
        )}
      </section>
    </div>
  );
}
