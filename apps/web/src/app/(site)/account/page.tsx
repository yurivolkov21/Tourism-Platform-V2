import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { DotMap } from '@/components/passport/dot-map';
import { JourneyRow } from '@/components/passport/journey-row';
import { PassportHeader } from '@/components/passport/passport-header';
import { SavedTuck } from '@/components/passport/saved-tuck';
import { StampRow } from '@/components/passport/stamp-row';
import { StatRow } from '@/components/passport/stat-row';
import { groupBookingsByTime } from '@/lib/account-stats';
import { BOOKINGS_MAX_LIMIT, BOOKINGS_PAGE_SIZE, fetchMyBookings } from '@/lib/api/bookings';
import { requireSession } from '@/lib/api/session';
import { fetchDestinations } from '@/lib/api/tours';
import { fetchMyWishlist } from '@/lib/api/wishlist';
import {
  journeySlugs,
  mapDots,
  memberNumber,
  mrzLine,
  passportStamps,
  passportStats,
} from '@/lib/passport';

/**
 * Trang HỘ CHIẾU — cửa duy nhất của khu account (spec 2026-08-11, M1+M4):
 * header passport + tem + stats + bản đồ + Your journey, thay cả hub LẪN trang
 * Trips cũ. Route con chỉ còn trang visa (booking detail), settings và saved.
 *
 * "Load more" GIỮ NGUYÊN pattern chunk `?page=` server-side của trang bookings
 * cũ (di cư sang đây): `chunk` đếm số lần bấm, fetch `limit = chunk × PAGE_SIZE`
 * kẹp trần — link cộng dồn danh sách, không cần JS client, URL chia sẻ được.
 */
export const metadata: Metadata = {
  title: `${messages.passportHome.kicker} — Tourism`,
  robots: { index: false },
};

export default async function AccountPassportPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await requireSession('/account');
  const { page: pageParam } = await searchParams;
  const chunk = Math.max(1, Number(pageParam) || 1);
  const limit = Math.min(chunk * BOOKINGS_PAGE_SIZE, BOOKINGS_MAX_LIMIT);

  const cookie = (await cookies()).toString();
  // Ba nguồn độc lập — chạy song song; destinations là dữ liệu public (cached),
  // wishlist chỉ để nuôi "ngăn kẹp" nên rỗng cũng không chặn trang.
  const [paged, destinations, wishlist] = await Promise.all([
    fetchMyBookings(cookie, limit),
    fetchDestinations(),
    fetchMyWishlist(cookie),
  ]);
  const bookings = paged.items;
  const hasMore = bookings.length < paged.total && limit < BOOKINGS_MAX_LIMIT;

  const t = messages.passportHome;
  const te = messages.passportEmpty;

  // sinceYear: SessionUser cố ý không phơi createdAt (xem session.ts) → lấy
  // năm của booking ĐẦU TIÊN, tài khoản mới tinh thì là năm hiện tại.
  const sinceYear = bookings.length
    ? Math.min(...bookings.map((b) => new Date(b.createdAt).getUTCFullYear()))
    : new Date().getUTCFullYear();

  const stats = passportStats(bookings, destinations.length);
  const stamps = passportStamps(bookings);
  const { visited, upcoming } = journeySlugs(bookings);
  const dots = mapDots(destinations, visited, upcoming);

  // Thứ tự journey: đang đi → sắp tới → đã qua (tái dùng bảng nhóm cũ — khẩn
  // trước, ký ức sau), hiển thị thành MỘT dòng chảy, không kicker từng nhóm.
  const grouped = groupBookingsByTime(bookings);
  const journey = [...grouped.onTheRoad, ...grouped.upcoming, ...grouped.past];

  const isEmpty = bookings.length === 0;

  return (
    <div>
      {/* Section GIẤY bleed hết viewport — texture kẻ ngang mờ bằng lớp phủ
          ink + mask (tokens-only, không oklch trong component). */}
      <section className="relative border-b border-border/55 bg-paper">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-ink/[0.04] [mask-image:repeating-linear-gradient(0deg,transparent_0_3px,black_3px_4px)]"
        />
        <div className="relative mx-auto max-w-5xl px-4 py-10 md:px-8 md:py-12">
          {isEmpty ? (
            <div className="text-center">
              <p className="text-[11px] font-bold tracking-[0.3em] text-ink/55 uppercase">
                {t.kicker}
              </p>
              <h1 className="mt-2 font-heading text-3xl font-semibold">{session.name ?? ''}</h1>
              <p className="mt-1 text-[12.5px] tracking-[0.16em] text-muted-foreground uppercase">
                {t.since(sinceYear)}
              </p>
              <div className="mt-8 flex justify-center">
                <StampRow stamps={stamps} />
              </div>
              <h2 className="mt-8 font-heading text-2xl font-semibold text-balance">
                {te.heading}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-pretty text-sm text-muted-foreground">
                {te.body}
              </p>
              <ButtonLink href="/tours" className="mt-6">
                {te.cta}
              </ButtonLink>
            </div>
          ) : (
            <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
              <PassportHeader
                name={session.name ?? session.email}
                sinceYear={sinceYear}
                location={null}
                mrz={mrzLine(session.name ?? session.email, memberNumber(session.id), sinceYear)}
                settingsHref="/account/settings"
              />
              <div className="max-w-[300px] md:pt-7">
                <StampRow stamps={stamps} />
              </div>
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-5xl px-4 md:px-8">
        <StatRow stats={stats} />

        {/* Hộ chiếu trống: không còn cột journey → bản đồ đứng GIỮA một cột,
            không để nó lệch phải cạnh một khoảng trống lớn. */}
        <div
          className={
            isEmpty
              ? 'mx-auto mt-9 max-w-md'
              : 'mt-9 grid gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]'
          }
        >
          <div>
            {isEmpty ? null : (
              <>
                <h2 className="mb-4 font-heading text-xl font-semibold">{t.journeyHeading}</h2>
                <div>
                  {journey.map((booking) => (
                    <JourneyRow key={booking.id} booking={booking} />
                  ))}
                </div>
                {hasMore ? (
                  <div className="mt-4 flex justify-end border-t border-border/55 pt-4">
                    <Link
                      href={`/account?page=${chunk + 1}`}
                      className="text-[13.5px] font-semibold text-primary-emphasis hover:underline"
                    >
                      {messages.accountBookings.loadMore}
                    </Link>
                  </div>
                ) : null}
              </>
            )}
          </div>
          <div>
            <h2 className="mb-4 font-heading text-xl font-semibold">{t.mapHeading}</h2>
            <DotMap dots={dots} caption={t.mapCaption(stats.places, destinations.length)} />
            {wishlist.length > 0 ? (
              <SavedTuck
                items={wishlist.map((w) => ({ slug: w.slug, title: w.title, image: null }))}
                total={wishlist.length}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
