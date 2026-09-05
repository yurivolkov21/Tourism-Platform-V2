import { BookingCodeSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { Frame, FramePanel } from '@tourism/ui/components/reui/frame';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookingActions } from '@/components/account/booking-actions';
import { ReviewComposer } from '@/components/account/review-composer';
import { ContentHero } from '@/components/content/content-hero';
import { RevealItem } from '@/components/motion/reveal-item';
import { VisaStamp } from '@/components/passport/visa-stamp';
import { fetchBookingByCode } from '@/lib/api/bookings';
import { requireSession } from '@/lib/api/session';
import { bookingView, refundSummary, toCancellationView } from '@/lib/booking-vm';
import { type ReviewSlot, reviewSlot } from '@/lib/review';
import { formatDate, formatMoney, formatMoneyExact } from '@/lib/tours';

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
  if (!booking) return { title: 'Booking not found — Nexora' };
  return {
    title: `${booking.tourTitle} — ${booking.code} — Nexora`,
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
  const slot = reviewSlot(booking);
  const cancellation = toCancellationView(booking.cancellationStatus);
  const view = bookingView(booking, cancellation);
  const terminalNote = t.terminalNote[view.statusKey];
  const refund = refundSummary(booking);
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
          {/* p-0: dense đã kéo panel sát viền khung nhưng panel vẫn còn
              padding nội bộ — bỏ nốt để dải tone dán sát viền trên cùng
              (góp ý user 12/08). */}
          <FramePanel className="overflow-hidden p-0">
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
                {/* Con dấu "đóng xuống" (`stamp`: 1.22→1, −6°→0°) — nhóm motion 3,
                    19/08; wrapper xoay về 0 còn con dấu bên trong giữ nghiêng 4° của nó. */}
                <RevealItem enter="stamp" delay={0.15}>
                  <VisaStamp status={booking.status} tone={view.tone} />
                </RevealItem>
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

              {refund ? <RefundLine refund={refund} currency={booking.currency} /> : null}

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
            <BookingActions
              view={view}
              code={booking.code}
              // Khách thấy mình được hoàn bao nhiêu TRƯỚC khi bấm gửi
              // (ADR-0030 §3b) — cùng phép tính mà màn quyết định của admin
              // dùng, nên hai bên không thể nói hai con số khác nhau.
              refund={{
                code: booking.code,
                tourTitle: booking.tourTitle,
                departureStartDate: booking.departureStartDate,
                departureEndDate: booking.departureEndDate,
                numAdults: booking.numAdults,
                numChildren: booking.numChildren,
                paidAt: booking.paidAt,
                freeCancellationDays: booking.freeCancellationDays,
                totalAmount: booking.totalAmount,
                refundedTotal: booking.refundedTotal,
                currency: booking.currency,
              }}
            />
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
              {/* Mảnh 1+2 cụm review-ảnh (12/08 UI, nối thật Task 9 —
                  ADR-0021): panel ảnh + panel form composite dính liền
                  thành một thẻ. State (publicIds đã upload + cờ busy) sống
                  trong `ReviewComposer` (client) vì page này là Server
                  Component. */}
              {/* Trạng thái NÓI TRƯỚC, form đứng sau (ADR-0032 §7). Trước đó
                  mọi review đã gửi rơi vào một nhánh duy nhất, nên khách bị
                  bác quay lại đọc thấy một lời cảm ơn. */}
              <ReviewSlotNote slot={slot} reason={booking.review?.moderationNote ?? null} />
              {slot === 'form' || slot === 'pending' || slot === 'rejected' ? (
                <ReviewComposer bookingCode={booking.code} review={booking.review ?? undefined} />
              ) : null}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

/**
 * Dòng tiền trên giấy tờ booking — cùng ngôn ngữ dashed-border với lưới IATA
 * phía trên, vì nó là một mục nữa của CÙNG bản ghi chứ không phải ghi chú rời.
 *
 * `formatMoneyExact` chứ không `formatMoney`: `formatMoney` cắt phần lẻ (giá
 * tour tròn trăm, chuyện biên tập), mà ở đây là số tiền THẬT khách đối chiếu
 * được với sao kê — in "$25" cho một khoản $24.50 là nói sai.
 */
function RefundLine({
  refund,
  currency,
}: {
  refund: NonNullable<ReturnType<typeof refundSummary>>;
  currency: string;
}) {
  const t = messages.accountBookingDetail.refundLine;
  return (
    <div className="border-b border-dashed border-border px-6 py-4 text-[13px] text-muted-foreground">
      <p>
        {refund.kind === 'full'
          ? t.full(formatMoneyExact(refund.amount, currency))
          : refund.kind === 'partial'
            ? t.partial(
                formatMoneyExact(refund.amount, currency),
                formatMoneyExact(refund.total, currency),
              )
            : t.none}
      </p>
      <p className="mt-0.5">
        {refund.kind === 'none' ? (
          // Không hoàn đồng nào thì câu tiếp theo phải là LÝ DO tra ở đâu,
          // không phải lời hứa về thời gian chờ.
          <Link href="/cancellation-policy" className="underline-offset-4 hover:underline">
            {t.schedule}
          </Link>
        ) : (
          t.timing
        )}
      </p>
    </div>
  );
}

/**
 * Câu nói trạng thái của chỗ đánh giá — mỗi slot một câu, không ternary lồng
 * nhau trong JSX.
 *
 * `rejected` và `rejectedFinal` cùng in LÝ DO nhưng khác hẳn câu sau đó: một
 * bên mời viết lại, một bên nói thẳng đã hết đường và mở lối liên hệ. Gộp
 * chúng là để khách bấm vào một form không còn ở đó.
 */
function ReviewSlotNote({ slot, reason }: { slot: ReviewSlot; reason: string | null }) {
  const rv = messages.reviews;
  if (slot === 'form') return null;

  if (slot === 'approved') {
    return <SlotNote title={rv.alreadyReviewedTitle} body={rv.alreadyReviewedBody} />;
  }
  if (slot === 'tooEarly') {
    return <SlotNote title={rv.tooEarlyTitle} body={rv.tooEarlyBody} />;
  }
  if (slot === 'pending') {
    return <SlotNote title={rv.pendingTitle} body={rv.pendingBody} />;
  }

  const final = slot === 'rejectedFinal';
  return (
    <div className="mb-4 flex flex-col gap-2">
      <SlotNote
        title={final ? rv.rejectedFinalTitle : rv.rejectedTitle}
        body={final ? rv.rejectedFinalBody : rv.rejectedBody}
      />
      {/* Nguyên văn lý do người duyệt viết — ĐÚNG câu khách đã nhận qua mail,
          nên hai nguồn không thể nói khác nhau. */}
      {reason ? (
        <figure className="rounded-md border border-border/60 bg-muted/40 p-3">
          <figcaption className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {rv.rejectedReason}
          </figcaption>
          <blockquote className="mt-1 text-sm whitespace-pre-wrap">{reason}</blockquote>
        </figure>
      ) : null}
      {final ? (
        <Link href="/contact" className="w-fit text-sm underline-offset-4 hover:underline">
          {messages.nav.contact}
        </Link>
      ) : null}
    </div>
  );
}

function SlotNote({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
