import { BookingCodeSchema, bookingPhase } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { BookingDetailView } from '@/components/account/booking-detail-view';
import { ContentHero } from '@/components/content/content-hero';
import { todayDateString } from '@/lib/account-stats';
import { fetchBookingByCode } from '@/lib/api/bookings';
import { requireSession } from '@/lib/api/session';
import { fetchTourDetailOrNull } from '@/lib/api/tours';
import { needsTourData } from '@/lib/get-ready';

/** Mã sai shape → null ngay (link cũ/bot), cùng nhánh notFound với mã lạ. */
async function findBooking(cookie: string, code: string) {
  if (!BookingCodeSchema.safeParse(code).success) return null;
  return fetchBookingByCode(cookie, code);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  // Best-effort cho tiêu đề đẹp — gate/404 thật là việc của thân trang.
  const cookie = (await cookies()).toString();
  let booking: Awaited<ReturnType<typeof findBooking>> = null;
  try {
    booking = await findBooking(cookie, code);
  } catch {
    booking = null;
  }
  if (!booking) return { title: 'Booking not found — Nexora' };
  return {
    title: `${booking.tourTitle} — ${booking.code} — Nexora`,
  };
}

/**
 * Chi tiết một đơn của khách (spec P7 §5): hero (breadcrumb "Booking", tên tour, mã đơn, nút
 * tròn quay về My bookings) rồi `BookingDetailView`. Trang chỉ nạp dữ liệu; bố cục ở
 * `BookingDetailView` để test được và đo được bằng CSS build thật.
 *
 * `h1` duy nhất là tiêu đề hero; tên tour trên vé là `h2` (spec §5.2 — bản cũ có hai `h1`).
 * "Hôm nay" là ngày lịch Việt Nam tính ở server (`todayDateString`, spec §2.1).
 */
export default async function AccountBookingDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  await requireSession(`/account/bookings/${code}`);
  const cookie = (await cookies()).toString();
  const booking = await findBooking(cookie, code);
  if (!booking) notFound();
  // MỘT mốc "hôm nay" cho cả quyết định đọc tour lẫn mọi khối của trang.
  const today = todayDateString();
  // Tour chỉ làm giàu hai giai đoạn (`needsTourData`: Get ready và Today's plan — spec §2.4); giai
  // đoạn khác không gọi API catalog. Tour đã gỡ hay API catalog hỏng đều rơi về `null`, trang vẫn
  // đủ vé, hành trình, tiền và hạn huỷ.
  const tour = needsTourData(bookingPhase(booking, today))
    ? await fetchTourDetailOrNull(booking.tourSlug)
    : null;

  return (
    <div>
      <ContentHero
        breadcrumb={messages.passportVisa.heroBreadcrumb}
        title={booking.tourTitle}
        meta={booking.code}
        back={{ href: '/account/bookings', label: messages.bookingDetail.back }}
      />
      <BookingDetailView booking={booking} tour={tour} today={today} />
    </div>
  );
}
