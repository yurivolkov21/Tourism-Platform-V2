import { BookingCodeSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { CheckoutShell } from '@/components/checkout/checkout-shell';
import { fetchBookingByCode } from '@/lib/api/bookings';
import { requireSession } from '@/lib/api/session';
import { pendingExpiry } from '@/lib/checkout';

export const metadata: Metadata = {
  title: `${messages.booking.cancel.title} — Tourism`,
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

  return (
    <CheckoutShell
      tone="warning"
      title={t.title}
      body={t.heldNote}
      code={booking?.code}
      codeLabel={booking ? messages.booking.success.refLabel : undefined}
    >
      {expiry && !expiry.expired ? (
        <p className="text-sm text-muted-foreground">
          {/* Một câu, không đếm ngược — thiết kế đã chốt là KHÔNG có đồng hồ
              chạy lùi trên bất kỳ màn nào của luồng này. */}
          {t.expiresIn(expiry.minutesLeft)}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-center gap-2.5">
        {booking ? (
          <ButtonLink href={`/account/bookings/${booking.code}`}>{t.manage}</ButtonLink>
        ) : (
          <ButtonLink href="/account/bookings">{messages.booking.list.menuLink}</ButtonLink>
        )}
        <ButtonLink variant="outline" href="/tours">
          {t.backToTours}
        </ButtonLink>
      </div>
    </CheckoutShell>
  );
}
