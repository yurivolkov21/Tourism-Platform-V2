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
import { formatDateRange, formatMoney, formatTicketDate } from '@/lib/tours';

/** Nhãn provider — TÁI DÙNG nguyên copy đã có ở `booking.form` (trang checkout
 *  chọn provider), cùng cách [code]/page.tsx làm — không thêm key i18n mới
 *  cho hai tên thương hiệu cố định. */
const PROVIDER_LABEL = {
  STRIPE: messages.booking.form.stripe,
  PAYPAL: messages.booking.form.paypal,
} as const;

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
          {/* Fix cuối 11/08: `/account/bookings` (trang Trips cũ) không còn
              là cửa vào bookings — hộ chiếu `/account` đã thay thế (spec
              2026-08-11, M1). Nhãn giữ nguyên `booking.list.menuLink`
              ("My bookings") — vẫn đúng ý dù đích đổi. */}
          <ButtonLink href="/account">{messages.booking.list.menuLink}</ButtonLink>
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

  const totalGuests = booking.numAdults + booking.numChildren;

  return (
    <CheckoutShell
      tone={mood === 'confirmed' ? 'success' : mood === 'confirming' ? 'warning' : 'muted'}
      title={title}
      body={body}
      code={booking.code}
      codeLabel={t.refLabel}
      stubName={booking.contactName}
      stubMeta={`${formatDateRange(booking.departureStartDate, booking.departureEndDate)} · ${t.guestsCount(totalGuests)}`}
    >
      {/* Khoảnh khắc primary kiểu boarding-pass — cặp ngày to nhất vé, đóng
          khung mảnh xoay -1deg như dấu mộc. Chỉ một vế khi tour trong ngày. */}
      <div className="-rotate-1 mx-auto flex flex-col items-center gap-1 rounded-md border px-5 py-2.5">
        <p className="font-mono text-[9px] tracking-[0.28em] text-muted-foreground uppercase">
          {t.dateLabel}
        </p>
        <p className="font-mono text-2xl font-semibold tracking-tight tabular-nums md:text-3xl">
          {formatTicketDate(booking.departureStartDate)}
          {booking.departureStartDate !== booking.departureEndDate ? (
            <>
              {' '}
              <span aria-hidden="true" className="text-muted-foreground">
                →
              </span>{' '}
              {formatTicketDate(booking.departureEndDate)}
            </>
          ) : null}
        </p>
      </div>

      <dl className="grid w-full gap-x-6 gap-y-4 text-sm sm:grid-cols-2">
        <Fact label={t.tourLabel} value={booking.tourTitle} />
        <Fact
          label={t.travellersLabel}
          value={`${messages.booking.page.adultsLine(booking.numAdults)}${
            booking.numChildren > 0
              ? `, ${messages.booking.page.childrenLine(booking.numChildren)}`
              : ''
          }`}
        />
        <Fact label={t.totalLabel} value={formatMoney(booking.totalAmount, booking.currency)} />
        <Fact label={t.paymentLabel} value={PROVIDER_LABEL[booking.paymentProvider]} />
      </dl>

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

/** Pattern nhãn/giá trị kiểu IATA: nhãn UPPERCASE nhỏ tracking rộng màu nhạt
 *  đứng TRÊN, giá trị đậm đứng DƯỚI — `tabular-nums` để số thẳng cột. */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="font-mono text-[10px] tracking-widest text-muted-foreground/80 uppercase">
        {label}
      </dt>
      <dd className="font-medium text-foreground tabular-nums">{value}</dd>
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
