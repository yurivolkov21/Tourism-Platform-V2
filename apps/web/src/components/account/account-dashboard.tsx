import type { Booking, WishlistItem } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import Link from 'next/link';
import {
  AccountRow,
  AccountRows,
  AccountSection,
  AccountSections,
} from '@/components/account/account-section';
import { BookingCard } from '@/components/account/booking-card';
import { dashboardStats, daysUntilDeparture, nextTrip, recentBookings } from '@/lib/account-stats';

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
    <AccountSections>
      {trip ? (
        <AccountSection title={t.nextTrip.heading} description={t.nextTrip.blurb}>
          {/* Không còn card nâng bằng `shadow-sm` và không còn ảnh placeholder:
              cả hai đều có mép riêng nằm ngoài lưới ba toạ độ, và ảnh thì hiện
              chỉ là ô xám (lô ảnh thật đã bị loại). Sức nặng của khối này nay
              do CON SỐ mang — đây là số lớn DUY NHẤT của cả khu account. */}
          <AccountRows>
            <AccountRow
              label={trip.tourTitle}
              sub={
                <span className="tabular-nums">
                  {t.nextTrip.departing(trip.departureStartDate)} ·{' '}
                  {t.nextTrip.travellers(trip.numAdults + trip.numChildren)}
                </span>
              }
            >
              <Countdown startDate={trip.departureStartDate} />
              <Link
                href={`/account/bookings/${trip.code}`}
                className="mt-1 block text-sm font-medium text-primary-emphasis underline-offset-4 hover:underline"
              >
                {t.nextTrip.viewBooking}
              </Link>
            </AccountRow>
          </AccountRows>
        </AccountSection>
      ) : null}

      {/* HAI ô số, không phải bốn: "upcoming"/"completed" lặp lại thứ khối
          "Recent bookings" ngay dưới đã nói rõ hơn. Nay chúng là hai DÒNG dữ
          liệu chứ không phải hai hộp — cùng khuôn với mọi dòng khác trong khu,
          và bỏ được hai mép hộp ngoài lưới. */}
      <AccountSection title={t.stats.heading} description={t.stats.blurb}>
        <AccountRows>
          {(['trips', 'saved'] as const).map((key) => (
            <AccountRow key={key} label={t.stats[key]}>
              <span className="font-mono text-sm text-foreground tabular-nums">{stats[key]}</span>
            </AccountRow>
          ))}
        </AccountRows>
      </AccountSection>

      <AccountSection
        title={t.recent.heading}
        description={t.recent.blurb}
        meta={
          <Link
            href="/account/bookings"
            className="text-primary-emphasis underline-offset-4 hover:underline"
          >
            {t.recent.viewAll}
          </Link>
        }
      >
        {recent.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.recent.empty}</p>
        ) : (
          /* Dùng lại NGUYÊN `BookingCard` của `/account/bookings` thay vì dựng
             bản thứ hai: hai màn hiện cùng một thứ thì phải cùng một dòng, và
             bản cũ ở đây còn mang pill `TONE_CLASS` — thứ đo được 1.90:1 ở chế
             độ sáng. */
          <AccountRows>
            {recent.map((booking) => (
              <BookingCard key={booking.id} booking={booking} />
            ))}
          </AccountRows>
        )}
      </AccountSection>
    </AccountSections>
  );
}
