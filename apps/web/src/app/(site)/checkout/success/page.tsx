import { BookingCodeSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { BookingReceipt } from '@/components/checkout/booking-receipt';
import { CheckoutAutoRefresh } from '@/components/checkout/checkout-auto-refresh';
import { PrintButton } from '@/components/checkout/print-button';
import { VoucherCard } from '@/components/checkout/voucher-card';
import { ContentHero } from '@/components/content/content-hero';
import { fetchBookingByCode } from '@/lib/api/bookings';
import { requireSession } from '@/lib/api/session';
import { fetchTourDetailOrNull } from '@/lib/api/tours';
import { checkoutMood } from '@/lib/checkout';
import { voucherView } from '@/lib/voucher';

export const metadata: Metadata = {
  // "Voucher" chứ không "Booking confirmed": trang này mở lại được bất cứ lúc nào, kể cả với
  // đơn đã huỷ — tiêu đề tab nói "đã xác nhận" là đúng lớp lỗi spec P7 §1 sửa ở thân trang.
  title: `${messages.booking.success.heroBreadcrumb} — Nexora`,
  // Trang per-user sau thanh toán: không có gì để index, và `robots.ts` cũng đã
  // disallow `/checkout/`. Khai ở đây thêm một lớp cho chắc.
  robots: { index: false, follow: false },
};

/**
 * Khách quay về từ cổng thanh toán. Cổng dựng URL này ở API
 * (`bookings.service.ts` — `successUrl: ${FRONTEND_URL}/checkout/success?code=…`),
 * nên `code` LUÔN tới qua query string, không phải qua route param.
 *
 * Hai nhánh (spec P7 §2.6): đơn ĐÃ TRẢ (có `paidAt`) mở voucher `VoucherCard` — vừa trả thì
 * chào "… is booked." kèm pháo giấy, mở lại thì "Your trip voucher"; đơn CHƯA TRẢ giữ hoá đơn
 * chờ `BookingReceipt` (PENDING tự làm tươi bằng `CheckoutAutoRefresh`, webhook về là chính
 * cây server đổi sang voucher).
 *
 * ⚠️ TRANG NÀY CẦN SESSION: `bookings.byCode` là procedure authed (không có
 * đường tra công khai theo mã). Cookie sống sót qua redirect top-level GET từ
 * Stripe/PayPal vì nó là `SameSite=Lax` — đó là điều kiện để trang này đọc
 * được booking ngay khi khách vừa từ cổng về.
 */
export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const { code } = await searchParams;
  await requireSession(`/checkout/success${code ? `?code=${code}` : ''}`);

  const t = messages.booking.success;

  // Mã không đúng shape (link cũ, gõ tay, bot) → dừng ngay, khỏi tốn round-trip.
  // KHÔNG `notFound()`: khách vừa trả tiền thật, một trang 404 trần ở đây là
  // khoảnh khắc tệ nhất có thể. Nói rõ không tìm thấy và chỉ đường về danh sách.
  const parsed = code ? BookingCodeSchema.safeParse(code) : null;
  const booking = parsed?.success
    ? await fetchBookingByCode((await cookies()).toString(), parsed.data)
    : null;

  if (!booking) {
    return (
      <div>
        <ContentHero breadcrumb={t.heroBreadcrumb} title={t.notFound} />
        <div className="mx-auto flex w-full max-w-2xl flex-wrap gap-2.5 px-4 pt-10 pb-16 md:pb-20">
          {/* "My bookings" trỏ đúng danh sách đơn (spec P7 §6.4) — bản cũ trỏ `/account` từ
              hồi danh sách đơn còn nằm trong trang hộ chiếu. */}
          <ButtonLink href="/account/bookings">{messages.booking.list.menuLink}</ButtonLink>
          <ButtonLink variant="outline" href="/tours">
            {t.viewTours}
          </ButtonLink>
        </div>
      </div>
    );
  }

  // Đồng hồ server đọc MỘT lần: `voucherView` đo 30 phút "vừa trả" và suy hôm nay (ngày lịch
  // Việt Nam, spec P7 §2.1) từ cùng mốc này.
  const view = voucherView(booking, new Date());

  if (!view) {
    // Đơn chưa có `paidAt` — PENDING đang chờ webhook, hay giữ chỗ hết hạn/bị huỷ khi chưa
    // trả: giữ NGUYÊN hoá đơn chờ. Mã của những đơn này chưa bao giờ là voucher.
    const mood = checkoutMood(booking);
    return (
      <div>
        {/* GIỮ `ContentHero`: `/checkout/success` nằm trong `HERO_LESS_EXCEPTIONS` của
            `site-header.tsx`, navbar ở đây giả định có mảng tối phía sau — gỡ hero là navbar
            tàng hình ở light mode (lỗi `/enquire` 19/08). Không `meta`: hoá đơn đã in mã ở
            bảng meta và ở cuống. */}
        <ContentHero
          breadcrumb={t.heroBreadcrumb}
          title={booking.tourTitle}
          action={<PrintButton />}
        />
        <div className="py-10 md:py-14">
          <BookingReceipt booking={booking} mood={mood} />
          <div className="mx-auto mt-8 flex w-full max-w-3xl flex-wrap items-center gap-2.5 px-4 print:hidden">
            <ButtonLink href={`/account/bookings/${booking.code}`}>{t.viewBooking}</ButtonLink>
            {mood === 'confirming' ? (
              <CheckoutAutoRefresh />
            ) : (
              <ButtonLink variant="outline" href="/tours">
                {t.viewTours}
              </ButtonLink>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Điểm hẹn lấy từ tour (cache 300 giây, tag `tour:<slug>`); tour đã gỡ hay lỗi gọi API catalog
  // đều rơi về null — voucher của đơn ĐÃ TRẢ không được sập vì một ô phụ.
  const tour = await fetchTourDetailOrNull(booking.tourSlug);

  return (
    <div>
      {/* Hero GIỮ (lý do ở nhánh trên) và thêm meta mã đơn (spec §6.1). Bản in chỉ in thẻ
          voucher, nên hero — cả nút Print trong đó — giấu khi in (spec §6.4). */}
      <div className="print:hidden">
        <ContentHero
          breadcrumb={t.heroBreadcrumb}
          title={booking.tourTitle}
          meta={booking.code}
          action={<PrintButton />}
        />
      </div>
      {/* Lề ngang CHÉP của hero (`px-4 md:px-16 lg:px-24 xl:px-32`, khung `max-w-7xl` trong
          thẻ) để mép thẻ thẳng hàng tiêu đề. */}
      <div className="px-4 py-10 md:px-16 md:py-14 lg:px-24 xl:px-32 print:p-0">
        <VoucherCard booking={booking} view={view} meetingPoint={tour?.meetingPoint ?? null} />
      </div>
    </div>
  );
}
