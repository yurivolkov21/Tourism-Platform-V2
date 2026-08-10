import type { Booking, WishlistItem } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import Link from 'next/link';
import { ImagePlaceholder } from '@/components/image-placeholder';
import { dashboardStats, daysUntilDeparture, nextTrip, recentBookings } from '@/lib/account-stats';
import { TONE_CLASS } from '@/lib/booking-tone';
import { bookingView } from '@/lib/booking-vm';
import { formatMoney } from '@/lib/tours';

/** Bao nhiêu dòng trong khối "Recent bookings" — bản trích ngắn, danh sách đủ
 *  nằm ở `/account/bookings`. */
const RECENT_LIMIT = 5;

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
 * Đồng hồ đếm ngược tới ngày khởi hành.
 *
 * "0 days away" đọc như một lỗi chứ không như tin vui, nên hai mốc gần nhất
 * dùng câu riêng. Chuyến đã qua không rơi vào đây — `nextTrip` chỉ trả chuyến
 * từ hôm nay trở đi.
 */
function Countdown({ startDate }: { startDate: string }) {
  const t = messages.accountDashboard.nextTrip;
  const days = daysUntilDeparture(startDate);

  if (days <= 1) {
    return (
      <p className="font-heading text-lg font-medium text-primary-emphasis">
        {days === 0 ? t.today : t.tomorrow}
      </p>
    );
  }
  return (
    <p className="flex flex-col leading-none">
      <span className="font-heading text-4xl font-semibold tabular-nums text-primary-emphasis">
        {days}
      </span>
      <span className="mt-1 text-xs text-muted-foreground">{t.daysAway}</span>
    </p>
  );
}

/**
 * Dashboard `/account` — redesign 10/08 theo mockup đã chốt.
 *
 * Đảo trục so với bản dựng tạm: thẻ "chuyến kế tiếp" LÊN ĐẦU và được nâng
 * (`shadow-sm`), rồi mới tới hai ô số, rồi "Recent bookings". Bản cũ mở bằng
 * bốn ô số — thứ trả lời câu "tôi có bao nhiêu" trong khi câu người ta thật sự
 * mở trang này để hỏi là "tôi sắp đi đâu, ngày nào".
 *
 * Ba thứ trong mockup KHÔNG dựng vì không có dữ liệu nuôi (spec §2): chuỗi
 * điểm đến trên thẻ (BookingSchema là snapshot, cố ý không mang), "departs
 * from …" (`meetingPoint` không thuộc bề mặt booking), và khối 3 tour đã lưu
 * (mockup đã bỏ hẳn). Vẽ chúng bằng dữ liệu bịa là vi phạm luật cứng #4 của
 * design brief.
 */
export function AccountDashboard({
  bookings,
  wishlist,
}: {
  bookings: Booking[];
  wishlist: WishlistItem[];
}) {
  const t = messages.accountDashboard;

  // "Empty tổng" = KHÔNG một booking nào, KHÔNG một tour đã lưu nào — khác
  // hẳn từng khối rỗng riêng lẻ (vẫn có dữ liệu ở nhánh khác).
  if (bookings.length === 0 && wishlist.length === 0) {
    return <EmptyState />;
  }

  const stats = dashboardStats(bookings, wishlist.length);
  const trip = nextTrip(bookings);
  const recent = recentBookings(bookings, RECENT_LIMIT);

  return (
    <div className="flex flex-col gap-10">
      {trip ? (
        <section>
          <h2 className="mb-2.5 font-mono text-xs tracking-widest text-muted-foreground uppercase">
            {t.nextTrip.heading}
          </h2>
          <div className="flex flex-col gap-5 rounded-2xl border bg-card p-5 shadow-sm sm:flex-row sm:items-center">
            <ImagePlaceholder className="aspect-[4/3] w-full shrink-0 rounded-xl sm:w-40" />
            <div className="flex min-w-0 flex-col gap-2">
              <p className="font-heading text-xl font-semibold text-foreground">{trip.tourTitle}</p>
              <p className="text-sm text-muted-foreground tabular-nums">
                {t.nextTrip.departing(trip.departureStartDate)} ·{' '}
                {t.nextTrip.travellers(trip.numAdults + trip.numChildren)}
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-start gap-1.5 sm:ml-auto sm:items-end">
              <Countdown startDate={trip.departureStartDate} />
              <Link
                href={`/account/bookings/${trip.code}`}
                className="text-sm font-medium text-primary-emphasis hover:underline"
              >
                {t.nextTrip.viewBooking}
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      {/* HAI ô số, không phải bốn: "upcoming"/"completed" lặp lại thứ khối
          "Recent bookings" ngay dưới đã nói rõ hơn. */}
      <dl className="grid grid-cols-2 gap-4">
        {(['trips', 'saved'] as const).map((key) => (
          <div key={key} className="rounded-2xl border bg-card p-5">
            <dt className="text-sm text-muted-foreground">{t.stats[key]}</dt>
            <dd className="mt-1 font-heading text-3xl font-semibold tabular-nums text-foreground">
              {stats[key]}
            </dd>
          </div>
        ))}
      </dl>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-medium text-foreground">{t.recent.heading}</h2>
          <Link href="/account/bookings" className="text-sm text-primary-emphasis hover:underline">
            {t.recent.viewAll}
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">{t.recent.empty}</p>
        ) : (
          /* MỘT tấm sheet ngăn bằng hairline thay vì nhiều card rời — bản cũ
             cho mỗi booking một khung viền, đọc thành danh sách hộp thay vì
             một bảng. `divide-y` giữ đường ngăn mảnh, không nhân đôi viền. */
          <ul className="mt-4 divide-y overflow-hidden rounded-2xl border bg-card">
            {recent.map((booking) => {
              const view = bookingView(booking);
              return (
                <li key={booking.id}>
                  <Link
                    href={`/account/bookings/${booking.code}`}
                    className="flex items-center gap-4 p-4 transition-colors hover:bg-accent/40"
                  >
                    <span className="hidden shrink-0 font-mono text-xs text-muted-foreground sm:inline">
                      {booking.code}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-foreground">
                        {booking.tourTitle}
                      </span>
                      <span className="block text-sm text-muted-foreground tabular-nums">
                        {booking.departureStartDate}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASS[view.tone]}`}
                    >
                      {/* Nguồn label status DUY NHẤT: `booking.list.status` —
                          cùng khối i18n trang `/account/bookings` dùng, tránh
                          drift chuỗi giữa hai nơi hiện cùng một enum. */}
                      {messages.booking.list.status[booking.status]}
                    </span>
                    <span className="hidden shrink-0 font-medium tabular-nums text-foreground sm:inline">
                      {formatMoney(booking.totalAmount, booking.currency)}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
