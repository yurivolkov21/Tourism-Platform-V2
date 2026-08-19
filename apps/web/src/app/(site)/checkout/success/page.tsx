import { BookingCodeSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { BookingReceipt } from '@/components/checkout/booking-receipt';
import { CheckoutAutoRefresh } from '@/components/checkout/checkout-auto-refresh';
import { PrintButton } from '@/components/checkout/print-button';
import { ContentHero } from '@/components/content/content-hero';
import { fetchBookingByCode } from '@/lib/api/bookings';
import { requireSession } from '@/lib/api/session';
import { checkoutMood } from '@/lib/checkout';

export const metadata: Metadata = {
  title: `${messages.booking.success.confirmedTitle} — Nexora`,
  // Trang per-user sau thanh toán: không có gì để index, và `robots.ts` cũng đã
  // disallow `/checkout/`. Khai ở đây thêm một lớp cho chắc.
  robots: { index: false, follow: false },
};

/**
 * Khách quay về từ cổng thanh toán. Cổng dựng URL này ở API
 * (`bookings.service.ts` — `successUrl: ${FRONTEND_URL}/checkout/success?code=…`),
 * nên `code` LUÔN tới qua query string, không phải qua route param.
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
    // Hero gánh luôn phần tiêu đề "không tìm thấy" (12/08 — trang voucher có
    // hero chuẩn); thân chỉ còn hai lối thoát, khỏi lặp title trong card.
    return (
      <div>
        <ContentHero breadcrumb={t.heroBreadcrumb} title={t.notFound} />
        <div className="mx-auto flex w-full max-w-2xl flex-wrap gap-2.5 px-4 pt-10 pb-16 md:pb-20">
          {/* Fix cuối 11/08: `/account/bookings` (trang Trips cũ) không còn
              là cửa vào bookings — hộ chiếu `/account` đã thay thế (spec
              2026-08-11, M1). Nhãn giữ nguyên `booking.list.menuLink`
              ("My bookings") — vẫn đúng ý dù đích đổi. */}
          <ButtonLink href="/account">{messages.booking.list.menuLink}</ButtonLink>
          <ButtonLink variant="outline" href="/tours">
            {t.viewTours}
          </ButtonLink>
        </div>
      </div>
    );
  }

  // `mood` là thứ DUY NHẤT trang còn tự tính; tiêu đề, câu mô tả và tổng số
  // khách đã chuyển hẳn vào `BookingReceipt` (nó cần cả ba để dựng pill, h1 và
  // dòng khách) — giữ lại ở đây là hai nguồn cho cùng một sự thật.
  const mood = checkoutMood(booking);

  return (
    <div>
      {/* GIỮ `ContentHero` — nó không chỉ là trang trí: `/checkout/success` nằm
          trong `HERO_LESS_EXCEPTIONS` của `site-header.tsx`, tức navbar ở đây
          giả định có mảng tối phía sau. Gỡ hero đi là navbar tàng hình ở light
          mode, đúng lỗi `/enquire` đã dính 19/08.

          Nhưng BỎ `meta`: nó vốn in mã đặt chỗ, mà receipt bên dưới đã in mã ở
          bảng meta VÀ ở cuống — giữ nữa là ba lần trên một màn.

          Nút Print đi vào slot `action` sẵn có của hero thay vì đẻ thêm một
          hàng nút riêng. */}
      <ContentHero
        breadcrumb={t.heroBreadcrumb}
        title={booking.tourTitle}
        action={<PrintButton />}
      />

      <div className="py-10 md:py-14">
        <BookingReceipt booking={booking} mood={mood} />

        <div className="mx-auto mt-8 flex w-full max-w-3xl flex-col gap-6 px-4">
          {/* "What happens next" — chỉ hiện ở mood confirmed: đây là ba việc SẼ
              xảy ra sau một lần thanh toán thành công, không có nghĩa ở hai mood
              còn lại (confirming chưa có gì để hứa; settled đã kết thúc). Khối
              này KHÔNG có trong wireframe receipt, nhưng nó là nội dung có thật
              và wireframe không phủ nhận nó — giữ. */}
          {mood === 'confirmed' ? (
            <div className="rounded-xl border p-5 print:hidden">
              <h2 className="font-heading text-sm font-semibold text-foreground">
                {t.nextHeading}
              </h2>
              <ul className="mt-3 flex flex-col gap-2">
                <NextStep text={t.nextEmail} />
                <NextStep text={t.nextVoucher} />
                <NextStep text={t.nextManage} />
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2.5 print:hidden">
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
    </div>
  );
}

function NextStep({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2.5 text-sm text-muted-foreground">
      <span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
      <span>{text}</span>
    </li>
  );
}
