import { BookingCodeSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { cn } from '@tourism/ui/lib/utils';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { PendingCard } from '@/components/checkout/pending-card';
import { ContentHero } from '@/components/content/content-hero';
import { ReceiptPrint } from '@/components/print/receipt-print';
import { fetchBookingByCode } from '@/lib/api/bookings';
import { requireSession } from '@/lib/api/session';
import { cancelPageRedirect } from '@/lib/checkout';
import { pendingView } from '@/lib/pending-receipt';
import { receiptPrintView } from '@/lib/print/receipt-print';
import { VOUCHER_PAGE_GUTTER } from '@/lib/voucher-layout';

export const metadata: Metadata = {
  title: messages.pageMeta.withBrand(messages.booking.cancel.title),
  robots: { index: false, follow: false },
};

/**
 * Khách bấm huỷ ở trang cổng thanh toán. KHÔNG có gì mất: booking vẫn tồn tại
 * ở PENDING và trả tiếp được ngay tại đây — thẻ chờ có nút Pay now (G42) — hay
 * từ trang chi tiết. Đơn đã trả (ở tab khác) không dựng trang này mà sang
 * voucher `/checkout/success` (`cancelPageRedirect`).
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
  // Đồng hồ server đọc MỘT lần: thẻ chờ (giờ nhả, giai đoạn) và hoá đơn chờ in (G40) cùng một mốc.
  const now = new Date();

  // Không tra được booking (thiếu mã, mã sai shape, hoặc không phải của khách
  // này) → không có gì để dựng hoá đơn. Vẫn KHÔNG `notFound()`: khách vừa rời
  // cổng thanh toán, một trang 404 trần ở đây là khoảnh khắc tệ nhất.
  if (!booking) {
    return (
      <div>
        <ContentHero breadcrumb={messages.pendingReceipt.breadcrumb} title={t.title} />
        <div className="mx-auto flex w-full max-w-3xl flex-wrap gap-2.5 px-4 pt-10 pb-16 md:pb-20">
          <ButtonLink href="/account/bookings">{messages.booking.list.menuLink}</ButtonLink>
          <ButtonLink variant="outline" href="/tours">
            {t.backToTours}
          </ButtonLink>
        </div>
      </div>
    );
  }

  // Đơn ĐÃ TRẢ (trả ở tab khác rồi bấm huỷ ở cổng): trang này kể chuyện của đơn chưa trả, nên
  // sang voucher — nơi đơn đã trả được kể đúng giai đoạn, kể cả đã huỷ (`cancelPageRedirect`).
  const voucherPath = cancelPageRedirect(booking);
  if (voucherPath) redirect(voucherPath);

  return (
    <div>
      <div className="print:hidden">
        {/* Cùng khuôn `/checkout/success` từ 19/08 (user chốt): hai màn quay-về
            của cùng một luồng mà dùng hai ngôn ngữ thị giác thì màn huỷ trông lạc
            lõng. `ContentHero` cũng là thứ cho navbar mảng tối — `/checkout` nằm
            trong `HERO_LESS_PREFIXES`, nhưng `/checkout/cancel` KHÔNG nằm trong
            `HERO_LESS_EXCEPTIONS`, nên navbar ở đây vẫn dùng kiểu đã-cuộn (nền
            đặc) và hero không làm hỏng gì. Breadcrumb "Checkout", không "Voucher":
            mã của đơn này chưa là voucher (G42). */}
        <ContentHero breadcrumb={messages.pendingReceipt.breadcrumb} title={booking.tourTitle} />

        {/* Thẻ chờ cùng khung và cùng lề với voucher (G42) — lề chép của hero, `sizes` của ảnh bìa
            trừ đúng lề này (`lib/voucher-layout.ts`). */}
        <div className={cn(VOUCHER_PAGE_GUTTER, 'py-10 md:py-14')}>
          <PendingCard booking={booking} view={pendingView(booking, now, 'cancel')} />
        </div>
      </div>
      {/* Trang huỷ không có nút Print (spec §4.1) — Ctrl+P in hoá đơn chờ B1 (G40, ADR-0057). */}
      <ReceiptPrint view={receiptPrintView(booking, now)} />
    </div>
  );
}
