import { BookingCodeSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { BookingReceipt } from '@/components/checkout/booking-receipt';
import { ContentHero } from '@/components/content/content-hero';
import { fetchBookingByCode } from '@/lib/api/bookings';
import { requireSession } from '@/lib/api/session';
import { checkoutMood, pendingExpiry } from '@/lib/checkout';

export const metadata: Metadata = {
  title: `${messages.booking.cancel.title} — Nexora`,
  robots: { index: false, follow: false },
};

/**
 * Khách bấm huỷ ở trang cổng thanh toán. KHÔNG có gì mất: booking vẫn tồn tại
 * ở PENDING và trả tiếp được từ trang chi tiết.
 *
 * ⚠️ Câu chữ ở đây tuyệt đối không được ngụ ý đang giữ ghế cho khách —
 * invariant #1 của API: một booking PENDING KHÔNG giữ seat nào (ghế chỉ được
 * claim nguyên tử ở đường webhook PAID). Xem spec cụm C §2.
 */
export default async function CheckoutCancelPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  await requireSession(`/checkout/cancel${code ? `?code=${code}` : ''}`);

  const t = messages.booking.cancel;

  const parsed = code ? BookingCodeSchema.safeParse(code) : null;
  const booking = parsed?.success
    ? await fetchBookingByCode((await cookies()).toString(), parsed.data)
    : null;

  // Hạn còn lại chỉ có nghĩa khi booking THẬT SỰ còn PENDING. Booking đã sang
  // trạng thái khác (hết hạn ngay trong lúc khách phân vân, hoặc đã trả tiền ở
  // tab khác) thì không in số phút — in số cho một thứ đã kết thúc là nói dối.
  const expiry = booking && booking.status === 'PENDING' ? pendingExpiry(booking.createdAt) : null;

  // Không tra được booking (thiếu mã, mã sai shape, hoặc không phải của khách
  // này) → không có gì để dựng hoá đơn. Vẫn KHÔNG `notFound()`: khách vừa rời
  // cổng thanh toán, một trang 404 trần ở đây là khoảnh khắc tệ nhất.
  if (!booking) {
    return (
      <div>
        <ContentHero breadcrumb={messages.booking.success.heroBreadcrumb} title={t.title} />
        <div className="mx-auto flex w-full max-w-3xl flex-wrap gap-2.5 px-4 pt-10 pb-16 md:pb-20">
          <ButtonLink href="/account/bookings">{messages.booking.list.menuLink}</ButtonLink>
          <ButtonLink variant="outline" href="/tours">
            {t.backToTours}
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Cùng khuôn `/checkout/success` từ 19/08 (user chốt): hai màn quay-về
          của cùng một luồng mà dùng hai ngôn ngữ thị giác thì màn huỷ trông lạc
          lõng. `ContentHero` cũng là thứ cho navbar mảng tối — `/checkout` nằm
          trong `HERO_LESS_PREFIXES`, nhưng `/checkout/cancel` KHÔNG nằm trong
          `HERO_LESS_EXCEPTIONS`, nên navbar ở đây vẫn dùng kiểu đã-cuộn (nền
          đặc) và hero không làm hỏng gì. */}
      <ContentHero breadcrumb={messages.booking.success.heroBreadcrumb} title={booking.tourTitle} />

      <div className="py-10 md:py-14">
        <BookingReceipt
          booking={booking}
          mood={checkoutMood(booking)}
          title={t.title}
          body={t.heldNote}
        >
          {expiry && !expiry.expired ? (
            <p className="text-sm text-muted-foreground">
              {/* Một câu, không đếm ngược — thiết kế đã chốt là KHÔNG có đồng hồ
                  chạy lùi trên bất kỳ màn nào của luồng này. */}
              {t.expiresIn(expiry.minutesLeft)}
            </p>
          ) : null}
        </BookingReceipt>

        <div className="mx-auto mt-8 flex w-full max-w-3xl flex-wrap items-center gap-2.5 px-4 print:hidden">
          <ButtonLink href={`/account/bookings/${booking.code}`}>{t.manage}</ButtonLink>
          <ButtonLink variant="outline" href="/tours">
            {t.backToTours}
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
