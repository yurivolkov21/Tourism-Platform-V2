import { BookingCodeSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { CheckoutAutoRefresh } from '@/components/checkout/checkout-auto-refresh';
import { CheckoutShell } from '@/components/checkout/checkout-shell';
import { fetchBookingByCode } from '@/lib/api/bookings';
import { requireSession } from '@/lib/api/session';
import { checkoutMood } from '@/lib/checkout';
import { formatDateRange, formatMoney } from '@/lib/tours';

export const metadata: Metadata = {
  title: `${messages.booking.success.confirmedTitle} — Tourism`,
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
    return (
      <CheckoutShell tone="muted" title={t.notFound}>
        <div className="flex flex-wrap gap-2.5">
          <ButtonLink href="/account/bookings">{messages.booking.list.menuLink}</ButtonLink>
          <ButtonLink variant="outline" href="/tours">
            {t.viewTours}
          </ButtonLink>
        </div>
      </CheckoutShell>
    );
  }

  const mood = checkoutMood(booking);
  const title =
    mood === 'confirmed'
      ? t.confirmedTitle
      : mood === 'confirming'
        ? t.pendingTitle
        : t.settledTitle;
  const body =
    mood === 'confirmed' ? t.confirmedBody : mood === 'confirming' ? t.pendingBody : t.settledBody;

  return (
    <CheckoutShell
      tone={mood === 'confirmed' ? 'success' : mood === 'confirming' ? 'warning' : 'muted'}
      title={title}
      body={body}
      code={booking.code}
      codeLabel={t.refLabel}
    >
      <dl className="grid w-full gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
        <Fact label={t.tourLabel} value={booking.tourTitle} />
        <Fact
          label={t.departureLabel}
          value={formatDateRange(booking.departureStartDate, booking.departureEndDate)}
        />
        <Fact
          label={t.travellersLabel}
          value={`${messages.booking.page.adultsLine(booking.numAdults)}${
            booking.numChildren > 0
              ? `, ${messages.booking.page.childrenLine(booking.numChildren)}`
              : ''
          }`}
        />
        <Fact label={t.totalLabel} value={formatMoney(booking.totalAmount, booking.currency)} />
      </dl>

      {mood === 'confirmed' ? <p className="text-sm text-muted-foreground">{t.emailNote}</p> : null}

      {/* "What happens next" — chỉ hiện ở mood confirmed: đây là ba việc SẼ
          xảy ra sau một lần thanh toán thành công, không có nghĩa ở hai mood
          còn lại (confirming chưa có gì để hứa; settled đã kết thúc). */}
      {mood === 'confirmed' ? (
        <div className="w-full rounded-xl border p-5 text-left">
          <h2 className="font-heading text-sm font-semibold text-foreground">{t.nextHeading}</h2>
          <ul className="mt-3 flex flex-col gap-2">
            <NextStep text={t.nextEmail} />
            <NextStep text={t.nextVoucher} />
            <NextStep text={t.nextManage} />
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2.5">
        <ButtonLink href={`/account/bookings/${booking.code}`}>{t.viewBooking}</ButtonLink>
        {mood === 'confirming' ? (
          <CheckoutAutoRefresh />
        ) : (
          <ButtonLink variant="outline" href="/tours">
            {t.viewTours}
          </ButtonLink>
        )}
      </div>
    </CheckoutShell>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-mono text-xs tracking-widest text-muted-foreground uppercase">{label}</dt>
      <dd className="text-foreground">{value}</dd>
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
