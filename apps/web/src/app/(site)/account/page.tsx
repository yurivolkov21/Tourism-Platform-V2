import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { SignOutButton } from '@/components/account/sign-out-button';
import { ContentHero } from '@/components/content/content-hero';
import { PassportCard } from '@/components/passport/passport-card';
import { TravelLog } from '@/components/passport/travel-log';
import { fetchAccountMe } from '@/lib/api/account';
import { BOOKINGS_MAX_LIMIT, fetchMyBookings } from '@/lib/api/bookings';
import { requireSession } from '@/lib/api/session';
import { fetchDestinations } from '@/lib/api/tours';
import { mrzLines, passportNo, passportStats, travelLog } from '@/lib/passport';

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
  // wishlist ĐÃ RÚT (12/08): thẻ Tucked inside nghỉ — Saved tours giờ là nút
  // trong khung, không cần đếm số tour đã lưu nữa.
  const [paged, destinations, me] = await Promise.all([
    fetchMyBookings(cookie, BOOKINGS_MAX_LIMIT),
    safe(fetchDestinations(), []),
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
  // Sổ hành trình: entries thuần từ lib (mỗi entry mang trips lần 1 → n
  // nuôi stepper) + ghép ảnh cover của catalog tại đây (giữ hàm thuần khỏi
  // type Media).
  const coverBySlug = new Map(destinations.map((d) => [d.slug, d.cover]));
  const logEntries = travelLog(destinations, bookings).map((e) => {
    const cover = coverBySlug.get(e.slug);
    return { ...e, cover: cover ? { url: cover.url, alt: cover.alt ?? null } : null };
  });
  const isEmpty = bookings.length === 0;

  return (
    <div>
      {/* Hero chuẩn site — Settings + My bookings đã dời VÀO góc phải khung
          hộ chiếu (góp ý 11/08 vòng mới); menu avatar navbar vẫn có Settings. */}
      <ContentHero breadcrumb={t.heroBreadcrumb} title={t.heroTitle} />
      <div className="mx-auto max-w-5xl px-4 pt-10 pb-16 md:px-8 md:pb-20">
        <PassportCard
          name={name}
          email={session.email}
          phone={me?.phone ?? null}
          sinceYear={sinceYear}
          passportNo={passportNo(session.id)}
          mrz={mrzLines(name, session.id, sinceYear)}
          image={me?.image ?? null}
          actions={
            <>
              <ButtonLink variant="outline" size="sm" href="/account/bookings">
                {t.bookingsLink}
              </ButtonLink>
              {/* Saved tours dời từ thẻ Tucked inside lên đây (góp ý user
                  12/08) — ba lối vào đứng chung một cụm trong khung. */}
              <ButtonLink variant="outline" size="sm" href="/account/saved">
                {t.savedLink}
              </ButtonLink>
              <ButtonLink variant="outline" size="sm" href="/account/settings">
                {t.settingsLink}
              </ButtonLink>
              <SignOutButton />
            </>
          }
        />

        {/* Dòng ledger nén thay hàng stats 4 ô (user chọn 11/08) — khít ngay
            dưới khung, cùng giọng fine-print với giấy tờ. */}
        <p className="mt-4 font-mono text-xs tracking-[0.06em] text-muted-foreground">
          {t.statLine(stats.trips, stats.places, stats.exploredPct, stats.daysOnRoad)}
        </p>

        {isEmpty ? (
          // Hộ chiếu mới tinh: lời mời đóng con tem đầu tiên đứng TRƯỚC lưới
          // (lưới toàn ô mờ tự thân đã là lời mời khám phá 19 nơi).
          <div className="mt-12 text-center">
            <h2 className="font-heading text-2xl font-semibold text-balance">{te.heading}</h2>
            <p className="mx-auto mt-2 max-w-md text-pretty text-sm text-muted-foreground">
              {te.body}
            </p>
            <ButtonLink href="/tours" className="mt-6">
              {te.cta}
            </ButtonLink>
          </div>
        ) : null}

        {/* SỔ HÀNH TRÌNH (vòng ReUI 11/08): chỉ hiện khi ĐÃ có chuyến hoàn
            thành — trái địa danh + ảnh, phải các lần đã đi. (Trang tem
            StampPages vẫn gỡ tạm từ vòng trước.) */}
        {logEntries.length > 0 ? (
          <section className="mt-12">
            <h2 className="mb-5 font-heading text-xl font-semibold">{t.travelLogHeading}</h2>
            <TravelLog entries={logEntries} />
          </section>
        ) : null}
      </div>
    </div>
  );
}
