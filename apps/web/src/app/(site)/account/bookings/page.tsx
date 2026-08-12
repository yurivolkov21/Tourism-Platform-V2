import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { ContentHero } from '@/components/content/content-hero';
import { BookingAccordion } from '@/components/passport/booking-accordion';
import { groupBookingsByTime, todayDateString } from '@/lib/account-stats';
import { BOOKINGS_MAX_LIMIT, BOOKINGS_PAGE_SIZE, fetchMyBookings } from '@/lib/api/bookings';
import { requireSession } from '@/lib/api/session';

/**
 * `/account/bookings` — "Your journey" dời TRỌN từ trang hộ chiếu sang
 * (addendum spec §7.4, user duyệt 11/08): route khôi phục từ redirect 308
 * thành trang danh sách thật, để trang passport tập trung vào thông tin
 * tài khoản.
 *
 * "Load more" GIỮ NGUYÊN pattern chunk `?page=` server-side (di cư theo từ
 * trang passport): `chunk` đếm số lần bấm, fetch `limit = chunk × PAGE_SIZE`
 * kẹp trần — link cộng dồn danh sách, không cần JS client, URL chia sẻ được.
 */
export const metadata: Metadata = {
  title: 'My bookings — Tourism',
  robots: { index: false },
};

export default async function AccountBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  await requireSession('/account/bookings');
  const { page: pageParam } = await searchParams;
  const chunk = Math.max(1, Number(pageParam) || 1);
  const limit = Math.min(chunk * BOOKINGS_PAGE_SIZE, BOOKINGS_MAX_LIMIT);

  const cookie = (await cookies()).toString();
  const paged = await fetchMyBookings(cookie, limit);
  const bookings = paged.items;
  const hasMore = bookings.length < paged.total && limit < BOOKINGS_MAX_LIMIT;

  const t = messages.passportBookings;

  // Thứ tự journey: đang đi → sắp tới → đã qua (khẩn trước, ký ức sau) —
  // một dòng chảy, không kicker từng nhóm (giữ nguyên từ trang passport cũ).
  const grouped = groupBookingsByTime(bookings);
  const journey = [...grouped.onTheRoad, ...grouped.upcoming, ...grouped.past];

  return (
    <div>
      <ContentHero breadcrumb={t.breadcrumb} title={t.title} meta={t.metaTrips(paged.total)} />
      <div className="mx-auto max-w-5xl px-4 pt-10 pb-16 md:px-8 md:pb-20">
        <Link
          href="/account"
          className="text-[13.5px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {t.back}
        </Link>

        {journey.length === 0 ? (
          <div className="mt-12 text-center">
            <h2 className="font-heading text-2xl font-semibold text-balance">{t.emptyHeading}</h2>
            <p className="mx-auto mt-2 max-w-md text-pretty text-sm text-muted-foreground">
              {t.emptyBody}
            </p>
            <ButtonLink href="/tours" className="mt-6">
              {t.emptyCta}
            </ButtonLink>
          </div>
        ) : (
          <div className="mt-6">
            {/* Accordion xổ-inline (vòng 12/08, pattern coupon-manager user
                tham khảo — dựng bằng đồ nhà): row đầu mở sẵn, chi tiết +
                action ngay tại chỗ, flow phức tạp vẫn ở trang chi tiết. */}
            <BookingAccordion bookings={journey} today={todayDateString()} />
            {hasMore ? (
              <div className="mt-4 flex justify-end border-t border-border/55 pt-4">
                <Link
                  href={`/account/bookings?page=${chunk + 1}`}
                  className="text-[13.5px] font-semibold text-primary-emphasis hover:underline"
                >
                  {messages.accountBookings.loadMore}
                </Link>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
