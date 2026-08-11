import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { ContentHero } from '@/components/content/content-hero';
import { DotMap } from '@/components/passport/dot-map';
import { PassportCard } from '@/components/passport/passport-card';
import { StampRow } from '@/components/passport/stamp-row';
import { StatRow } from '@/components/passport/stat-row';
import { TuckCard } from '@/components/passport/tuck-card';
import { fetchAccountMe } from '@/lib/api/account';
import { BOOKINGS_MAX_LIMIT, fetchMyBookings } from '@/lib/api/bookings';
import { requireSession } from '@/lib/api/session';
import { fetchDestinations } from '@/lib/api/tours';
import { fetchMyWishlist } from '@/lib/api/wishlist';
import {
  journeySlugs,
  mapDots,
  mrzLines,
  passportNo,
  passportStamps,
  passportStats,
} from '@/lib/passport';

/**
 * Trang HỘ CHIẾU — cửa của khu account (spec 2026-08-11 + addendum §7.4,
 * user duyệt 11/08): THÔNG TIN TÀI KHOẢN đứng đầu (khung PassportCard),
 * rồi mới tới phân tích (stats) và lưu niệm (tem + bản đồ). Danh sách
 * booking "Your journey" đã dời TRỌN sang `/account/bookings` — ở đây chỉ
 * còn thẻ lối vào.
 *
 * Hết phân trang: không còn danh sách nên fetch bookings MỘT Lần kẹp trần
 * `BOOKINGS_MAX_LIMIT` để nuôi stats/tem/bản đồ (nhiều dữ liệu hơn bản cũ
 * vốn chỉ tính trên chunk trang đầu).
 */
export const metadata: Metadata = {
  title: 'Traveler passport — Tourism',
  robots: { index: false },
};

export default async function AccountPassportPage() {
  const session = await requireSession('/account');
  const cookie = (await cookies()).toString();

  // Bốn nguồn song song — CHỈ `fetchMyBookings` được ném lỗi (dữ liệu chính);
  // ba nguồn phụ bọc `safe()`: destinations/wishlist fallback rỗng, account/me
  // fallback null (mất phone thì ẩn dòng, không kéo sập trang).
  const safe = <T,>(p: Promise<T>, fallback: T): Promise<T> => p.catch(() => fallback);
  const [paged, destinations, wishlist, me] = await Promise.all([
    fetchMyBookings(cookie, BOOKINGS_MAX_LIMIT),
    safe(fetchDestinations(), []),
    safe(fetchMyWishlist(cookie), []),
    safe(fetchAccountMe(cookie), null),
  ]);
  const bookings = paged.items;

  const t = messages.passportHome;
  const te = messages.passportEmpty;

  // sinceYear: SessionUser cố ý không phơi createdAt (xem session.ts) → lấy
  // năm của booking ĐẦU TIÊN, tài khoản mới tinh thì là năm hiện tại.
  const sinceYear = bookings.length
    ? Math.min(...bookings.map((b) => new Date(b.createdAt).getUTCFullYear()))
    : new Date().getUTCFullYear();

  const name = session.name || session.email;
  const stats = passportStats(bookings, destinations.length);
  const stamps = passportStamps(bookings);
  const { visited, upcoming } = journeySlugs(bookings);
  const dots = mapDots(destinations, visited, upcoming);
  const isEmpty = bookings.length === 0;

  return (
    <div>
      {/* Hero chuẩn site; Settings là ACTION của hero (control UI không nằm
          trên giấy tờ — góp ý 11/08; menu avatar navbar cũng có mục này). */}
      <ContentHero
        breadcrumb={t.heroBreadcrumb}
        title={t.heroTitle}
        action={
          <ButtonLink variant="outline" size="sm" href="/account/settings">
            {t.settingsLink}
          </ButtonLink>
        }
      />
      <div className="mx-auto max-w-5xl px-4 pt-10 pb-16 md:px-8 md:pb-20">
        <PassportCard
          name={name}
          email={session.email}
          phone={me?.phone ?? null}
          sinceYear={sinceYear}
          passportNo={passportNo(session.id)}
          mrz={mrzLines(name, session.id, sinceYear)}
        />

        <div className="mt-10">
          <StatRow stats={stats} />
        </div>

        {isEmpty ? (
          // Hộ chiếu mới tinh: lời mời đóng con tem đầu tiên (tem ghost
          // phóng to) + bản đồ chờ tô màu đứng giữa một cột.
          <div className="mt-10 text-center">
            <div className="flex justify-center">
              <div className="scale-125">
                <StampRow stamps={stamps} />
              </div>
            </div>
            <h2 className="mt-10 font-heading text-2xl font-semibold text-balance">{te.heading}</h2>
            <p className="mx-auto mt-2 max-w-md text-pretty text-sm text-muted-foreground">
              {te.body}
            </p>
            <ButtonLink href="/tours" className="mt-6">
              {te.cta}
            </ButtonLink>
            {destinations.length > 0 ? (
              <div className="mx-auto mt-10 max-w-md text-left">
                <DotMap dots={dots} caption={t.mapCaption(stats.places, destinations.length)} />
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <div className="mt-9 grid gap-10 lg:grid-cols-2">
              <div>
                <h2 className="mb-4 font-heading text-xl font-semibold">{t.stampsHeading}</h2>
                <StampRow stamps={stamps} />
              </div>
              <div>
                {/* destinations rỗng (catalog trống hoặc fetch phụ hỏng đã bị
                    `safe()` nuốt) → ẩn khối bản đồ: "0 of our 0" vô nghĩa. */}
                {destinations.length > 0 ? (
                  <>
                    <h2 className="mb-4 font-heading text-xl font-semibold">{t.mapHeading}</h2>
                    <DotMap dots={dots} caption={t.mapCaption(stats.places, destinations.length)} />
                  </>
                ) : null}
              </div>
            </div>
            {/* Hai lối vào "ngăn kẹp": bookings luôn có (đang nhánh không
                rỗng); saved chỉ hiện khi có tour đã lưu. */}
            <div className="mt-10 grid gap-4 sm:grid-cols-2">
              <TuckCard
                heading={t.bookingsHeading(paged.total)}
                href="/account/bookings"
                cta={t.bookingsOpen}
              />
              {wishlist.length > 0 ? (
                <TuckCard
                  heading={t.savedHeading(wishlist.length)}
                  href="/account/saved"
                  cta={t.savedOpen}
                />
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
