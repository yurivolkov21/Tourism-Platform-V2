import { BookingCodeSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { Frame, FramePanel } from '@tourism/ui/components/reui/frame';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookingActions } from '@/components/account/booking-actions';
import { ReviewForm } from '@/components/account/review-form';
import { ReviewPhotoUpload } from '@/components/account/review-photo-upload';
import { ContentHero } from '@/components/content/content-hero';
import { VisaStamp } from '@/components/passport/visa-stamp';
import { fetchBookingByCode } from '@/lib/api/bookings';
import { requireSession } from '@/lib/api/session';
import { bookingView, toCancellationView } from '@/lib/booking-vm';
import { reviewSlot } from '@/lib/review';
import { formatDate, formatMoney } from '@/lib/tours';

/** Nhãn provider — TÁI DÙNG copy `booking.form` như trước, không key mới. */
const PROVIDER_LABEL = {
  STRIPE: messages.booking.form.stripe,
  PAYPAL: messages.booking.form.paypal,
} as const;

/** Dải màu mảnh trên đầu giấy tờ — cùng logic tone với mép cuống vé checkout. */
const STRIP_CLASS = {
  success: 'bg-success/70',
  warning: 'bg-warning/70',
  muted: 'bg-muted',
  destructive: 'bg-muted',
} as const;

/**
 * `24 → 26 AUG` — cặp ngày kiểu boarding-pass cho lưới IATA; chuyến một ngày
 * chỉ còn một vế. Dựng từ ISO calendar date, KHÔNG đụng timezone (cùng lý do
 * `formatDateRange` dùng UTC).
 */
function iataDates(startDate: string, endDate: string): string {
  const short = (iso: string) => {
    const d = new Date(iso);
    const month = d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }).toUpperCase();
    return `${d.getUTCDate()} ${month}`;
  };
  if (startDate === endDate) return short(startDate);
  const sameMonth = startDate.slice(0, 7) === endDate.slice(0, 7);
  const left = sameMonth ? String(new Date(startDate).getUTCDate()) : short(startDate);
  return `${left} → ${short(endDate)}`;
}

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
  if (!booking) return { title: 'Booking not found — Tourism' };
  return {
    title: `${booking.tourTitle} — ${booking.code} — Tourism`,
    robots: { index: false },
  };
}

/**
 * Trang VISA (spec 2026-08-11, M2) — chi tiết booking dựng như giấy tờ dán
 * trong hộ chiếu: khối `v-doc` mang dải tone + mộc trạng thái + lưới nhãn
 * IATA + fine print; "View voucher" mở ĐÚNG tấm vé boarding-pass bên checkout
 * (`/checkout/success?code=…`) — một vũ trụ ấn phẩm, không dựng vé thứ hai.
 * Hành động hủy GIỮ NGUYÊN flow `BookingActions` (text-link + dialog + lý do).
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

  const t = messages.accountBookingDetail;
  const tv = messages.passportVisa;
  const rv = messages.reviews;
  const slot = reviewSlot(booking);
  const cancellation = toCancellationView(booking.cancellationStatus);
  const view = bookingView(booking, cancellation);
  const terminalNote = t.terminalNote[view.statusKey];
  const sec = t.sections;

  return (
    <div>
      {/* Hero chuẩn site (vòng góp ý 11/08): title = tên tour, meta = mã —
          giấy visa bên dưới vẫn in đủ (giấy tờ tự thân đầy đủ là tự nhiên). */}
      <ContentHero breadcrumb={tv.heroBreadcrumb} title={booking.tourTitle} meta={booking.code} />
      <div className="mx-auto max-w-3xl px-4 pt-10 pb-16 md:px-8 md:pb-20">
        <Link
          href="/account"
          className="text-[13.5px] text-muted-foreground transition-colors hover:text-foreground"
        >
          {tv.back}
        </Link>

        {/* ── Giấy tờ visa — lên khung Frame (góp ý user 12/08: đồng bộ với
            khối review bên dưới; `dense` bỏ padding panel để dải tone + ảnh
            vẫn full-bleed trong khung). ── */}
        <Frame className="mt-4 w-full" dense>
          <FramePanel className="overflow-hidden">
            <article className="overflow-hidden bg-card">
              <div aria-hidden="true" className={`h-1.5 ${STRIP_CLASS[view.tone]}`} />
              <header className="grid gap-4 border-b border-dashed border-border px-6 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                <div>
                  <p className="text-[11px] font-bold tracking-[0.3em] text-ink uppercase">
                    {tv.kicker}
                  </p>
                  <h1 className="mt-1.5 font-heading text-2xl font-semibold text-balance">
                    {booking.tourTitle}
                  </h1>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    <Link
                      href={`/tours/${booking.tourSlug}`}
                      className="font-semibold text-primary-emphasis underline-offset-4 hover:underline"
                    >
                      {t.viewTour} →
                    </Link>
                  </p>
                </div>
                <VisaStamp status={booking.status} tone={view.tone} />
              </header>

              {booking.tourImage ? (
                // biome-ignore lint/performance/noImgElement: repo không dùng next/image (chưa cấu hình remotePatterns — tiền lệ trip-card/checkout-summary).
                <img
                  src={booking.tourImage.url}
                  alt={booking.tourImage.alt ?? ''}
                  className="h-48 w-full object-cover"
                />
              ) : null}

              {/* Lưới nhãn IATA: nhãn UPPERCASE nhỏ TRÊN, giá trị đậm DƯỚI — cùng
              ngôn ngữ với tấm vé checkout. */}
              <dl className="grid grid-cols-2 gap-x-5 gap-y-4 border-b border-dashed border-border px-6 py-5 md:grid-cols-4">
                <div>
                  <dt className="text-[9.5px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
                    {tv.labels.dates}
                  </dt>
                  <dd className="mt-0.5 font-mono text-[15px] font-semibold tabular-nums">
                    {iataDates(booking.departureStartDate, booking.departureEndDate)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[9.5px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
                    {tv.labels.travellers}
                  </dt>
                  <dd className="mt-0.5 text-[15px] font-semibold">
                    {messages.accountBookings.travellers(booking.numAdults, booking.numChildren)}
                  </dd>
                </div>
                <div>
                  <dt className="text-[9.5px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
                    {tv.labels.reference}
                  </dt>
                  <dd className="mt-0.5 font-mono text-[15px] font-semibold">{booking.code}</dd>
                </div>
                <div>
                  <dt className="text-[9.5px] font-bold tracking-[0.14em] text-muted-foreground uppercase">
                    {tv.labels.total}
                  </dt>
                  <dd className="mt-0.5 font-mono text-[15px] font-semibold tabular-nums">
                    {formatMoney(booking.totalAmount, booking.currency)}
                  </dd>
                </div>
              </dl>

              {/* Hàng hành động của giấy tờ: voucher CHỈ khi đã trả tiền (tấm vé
              bên checkout là vé của booking PAID); Contact luôn có. PENDING
              trả tiền qua `BookingActions` phía dưới — giữ nguyên flow thật. */}
              <div className="flex flex-wrap items-center gap-3 px-6 py-4">
                {view.tone === 'success' ? (
                  <ButtonLink href={`/checkout/success?code=${booking.code}`}>
                    {tv.viewVoucher}
                  </ButtonLink>
                ) : null}
                <ButtonLink variant="outline" href="/contact">
                  {tv.contactUs}
                </ButtonLink>
              </div>

              <p className="px-6 pb-4 font-mono text-[9.5px] leading-relaxed tracking-[0.06em] text-muted-foreground">
                {tv.fineLine(
                  booking.contactName,
                  booking.contactEmail,
                  // `createdAt` là ISO datetime đầy đủ — `formatDate` chỉ nhận
                  // calendar date (tách chuỗi, không qua new Date) nên phải cắt
                  // phần ngày trước, không thì ra "NaN AUG" (bug bắt ở nghiệm thu).
                  formatDate(booking.createdAt.slice(0, 10)),
                  PROVIDER_LABEL[booking.paymentProvider],
                )}
                {booking.specialRequests ? (
                  <>
                    <br />
                    {tv.requestsLine(booking.specialRequests)}
                  </>
                ) : null}
              </p>
            </article>
          </FramePanel>
        </Frame>

        {/* ── Dưới giấy tờ: trạng thái terminal + hành động hủy (flow cũ) ── */}
        <div className="mt-5">
          {terminalNote ? (
            <p className="mb-3 text-sm text-muted-foreground">{terminalNote}</p>
          ) : null}
          {/* cancelLead ("Need to change plans?") chỉ có nghĩa khi còn HÀNH
              ĐỘNG HỦY để câu dẫn tới — PENDING vừa có payNow vừa có
              cancelPending; nút "Pay now" + "Cancel booking" bên dưới đã tự
              nói đủ, câu dẫn hủy đứng riêng ở đây đọc lạc trọng tâm (khách
              vừa mở trang, còn chưa chắc đã hủy). Chỉ ẩn khi payNow còn mặt
              trong actions — mọi trạng thái PAID/khác vẫn giữ nguyên câu dẫn. */}
          {!view.actions.includes('payNow') ? (
            <p className="text-sm text-muted-foreground">{tv.cancelLead}</p>
          ) : null}
          <div className="mt-1.5">
            <BookingActions view={view} code={booking.code} />
          </div>
        </div>

        {/* Review giữ nguyên slot logic + đích anchor #review từ journey. */}
        {slot === 'hidden' ? null : (
          // MỘT CỘT theo góp ý user 11/08 — heading đứng trên, nội dung in
          // thẳng lên giấy, không còn lưới hai-cột/card của AccountSection.
          <section id="review" className="mt-10 border-t border-border/55 pt-6">
            <h2 className="font-heading text-lg font-semibold">{sec.reviewHeading}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{sec.reviewBlurb}</p>
            <div className="mt-3">
              {/* Mảnh 1+2 cụm review-ảnh (12/08) trong MỘT Frame stacked
                  (user chỉ định đóng khung ngoài): panel ảnh + panel form
                  composite dính liền thành một thẻ. Upload còn static-first
                  (mô phỏng), mảnh backend nối Cloudinary + gắn ảnh vào
                  submit sau. */}
              {slot === 'form' ? (
                <Frame stacked className="w-full">
                  <FramePanel>
                    <ReviewPhotoUpload />
                  </FramePanel>
                  <FramePanel>
                    <ReviewForm bookingCode={booking.code} />
                  </FramePanel>
                </Frame>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {slot === 'done' ? rv.alreadyReviewedBody : rv.tooEarlyBody}
                </p>
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
