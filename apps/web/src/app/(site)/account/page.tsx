import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { ContentHero } from '@/components/content/content-hero';
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
  mrzLines,
  passportNo,
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
  // Literal (fix 11/08): `passportHome.kicker` = 'Traveler passport · Tourism'
  // — ghép template cũ ra "Traveler passport · Tourism — Tourism" (trùng chữ
  // Tourism, dấu · lẫn dấu —). Tiêu đề tab không cần đi qua i18n cho một
  // chuỗi cố định như thế này.
  title: 'Traveler passport — Tourism',
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
  // wishlist chỉ để nuôi "ngăn kẹp" nên rỗng cũng không chặn trang. Fix
  // 11/08: CHỈ `fetchMyBookings` được phép ném lỗi (nó là dữ liệu CHÍNH của
  // trang, lỗi ở đó thì trang không còn gì để hiện) — hai nguồn kia bọc
  // `safe()` với fallback rỗng để một API phụ hỏng không kéo sập cả trang
  // hộ chiếu của khách.
  const safe = <T,>(p: Promise<T>, fallback: T): Promise<T> => p.catch(() => fallback);
  const [paged, destinations, wishlist] = await Promise.all([
    fetchMyBookings(cookie, limit),
    safe(fetchDestinations(), []),
    safe(fetchMyWishlist(cookie), []),
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

  // Một component cho cả hai nhánh (fix 11/08): hộ chiếu trống trước đây tự
  // dựng lại kicker/tên/since bằng tay và ĐÁNH RƠI link ⚙ Settings — một ngõ
  // cụt thật sự khi khách chưa có booking nào nhưng vẫn cần đường vào
  // settings đổi tên.
  const header = <PassportHeader name={session.name || session.email} sinceYear={sinceYear} />;
  // Cặp dòng MRZ chuẩn TD3 (2 × 44 ký tự, check digit thật) + dòng đồ đạc
  // Type/Code/Passport No. — in thành dải máy đọc cuối khối danh tính, THU
  // trong khổ nội dung (không tràn màn hình — góp ý user 11/08 vòng 2).
  const no = passportNo(session.id);
  const passportNoDisplay = `${no.slice(0, 2)} ${no.slice(2, 5)} ${no.slice(5)}`;
  const mrz = mrzLines(session.name || session.email, session.id, sinceYear);

  return (
    <div>
      {/* Hero chuẩn site (vòng góp ý 11/08) — cùng khuôn faq/contact/tours,
          navbar đứng trên nền tối như mọi trang; danh tính ở trang giấy dưới.
          Settings đứng làm ACTION của hero (góp ý cùng ngày: control UI rời
          tờ giấy — giấy chỉ còn giấy tờ; menu avatar navbar cũng có mục này). */}
      <ContentHero
        breadcrumb={t.heroBreadcrumb}
        title={t.heroTitle}
        action={
          <ButtonLink variant="outline" size="sm" href="/account/settings">
            {t.settingsLink}
          </ButtonLink>
        }
      />
      {/* Nền THƯỜNG như mọi trang content (góp ý user 11/08 vòng 3): lớp
          bg-paper + texture + gáy + mép trang cũ tạo một dải phân lớp lộ rõ
          trước footer — gỡ trọn, chất passport nằm ở tem/MRZ/typography. */}
      <section className="relative border-b border-border/55">
        <div className="relative mx-auto max-w-5xl px-4 py-10 md:px-8 md:py-12">
          {isEmpty ? (
            // Header căn trái NHƯ nhánh thường; chỉ khối mời-đóng-tem-đầu-
            // tiên bên dưới mới căn giữa.
            <div>
              {header}
              <div className="mt-8 text-center">
                {/* Tem ghost phóng to ở empty state — lời mời "con tem đầu
                    tiên" cần chiếm không gian, không lẫn vào một hàng tem nhỏ
                    như nhánh có dữ liệu. */}
                <div className="flex justify-center">
                  <div className="scale-125">
                    <StampRow stamps={stamps} />
                  </div>
                </div>
                <h2 className="mt-10 font-heading text-2xl font-semibold text-balance">
                  {te.heading}
                </h2>
                <p className="mx-auto mt-2 max-w-md text-pretty text-sm text-muted-foreground">
                  {te.body}
                </p>
                <ButtonLink href="/tours" className="mt-6">
                  {te.cta}
                </ButtonLink>
              </div>
            </div>
          ) : (
            <div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
              {header}
              <div className="max-w-[300px] md:pt-7">
                <StampRow stamps={stamps} />
              </div>
            </div>
          )}
          {/* Vùng đọc máy (Zone VII): khối bo góc nền `card` sáng hơn nền
                trang một bậc — dấu hiệu "vùng máy đọc" của MRZ; đồ đạc giấy
                tờ (Type/Code/Passport No.) đứng làm caption của dải, tránh
                xa khối danh tính. Trang trí thuần (aria-hidden), cắt bằng
                overflow, KHÔNG wrap. */}
          <div aria-hidden="true" className="mt-8">
            <p className="font-mono text-[9.5px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
              {t.zoneType} {t.zoneTypeValue} · {t.zoneCode} {t.zoneCodeValue} · {t.zoneNo}{' '}
              {passportNoDisplay}
            </p>
            <div className="mt-1.5 overflow-hidden rounded-lg border border-border/55 bg-card px-4 py-2.5 font-mono text-[10.5px] leading-[1.8] tracking-[0.08em] whitespace-nowrap text-ink/70 select-none md:text-[13px] md:tracking-[0.18em]">
              <p>{mrz[0]}</p>
              <p>{mrz[1]}</p>
            </div>
          </div>
        </div>
      </section>

      {/* pb theo nhịp trang content chuẩn (faq py-16/20) — khoảng cách tới
            footer từ đây + `mt-32` của footer, không còn tầng đệm riêng. */}
      <div className="mx-auto max-w-5xl px-4 pb-16 md:px-8 md:pb-20">
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
            {/* destinations rỗng (catalog thật rỗng, hoặc fetch phụ hỏng đã
                bị `safe()` nuốt lỗi ở trên) → ẩn cả khối bản đồ: caption đếm
                "0 of our 0 destinations" không nói được gì. */}
            {destinations.length > 0 ? (
              <>
                <h2 className="mb-4 font-heading text-xl font-semibold">{t.mapHeading}</h2>
                <DotMap dots={dots} caption={t.mapCaption(stats.places, destinations.length)} />
              </>
            ) : null}
            {wishlist.length > 0 ? <SavedTuck total={wishlist.length} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
