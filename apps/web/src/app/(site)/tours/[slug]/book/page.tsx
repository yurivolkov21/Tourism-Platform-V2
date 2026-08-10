import { messages } from '@tourism/i18n';
import { ChevronRightIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookingModes } from '@/components/booking/booking-modes';
import type { CheckoutSummaryTour } from '@/components/booking/checkout-summary';
import { requireSession } from '@/lib/api/session';
import { fetchTourDetail } from '@/lib/api/tours';
import { routeChain } from '@/lib/tours';

export const metadata: Metadata = {
  title: `${messages.booking.page.title} — Tourism`,
  robots: { index: false, follow: false },
};

/**
 * Form đặt chỗ. Trang DYNAMIC per-user (cần session, và điền sẵn tên/email của
 * người đang đăng nhập) — KHÔNG `generateStaticParams`, KHÔNG `loading.tsx`
 * (luật soft-404 của repo: Suspense boundary ở đây biến `notFound()` thành
 * soft-404 trả HTTP 200).
 */
export default async function BookTourPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await requireSession(`/tours/${slug}/book`);
  const tour = await fetchTourDetail(slug);
  if (!tour) notFound();

  const t = messages.booking.page;

  // Card tóm tắt (T2/T3) chỉ cần lát cắt nhỏ của `tour` — xem lý do tách ở
  // JSDoc `CheckoutSummaryTour`.
  const summaryTour: CheckoutSummaryTour = {
    title: tour.title,
    cover: tour.cover,
    durationDays: tour.durationDays,
    destinationNames: tour.destinations.map((d) => d.name),
    ratingAvg: tour.ratingAvg,
    ratingCount: tour.ratingCount,
  };

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 md:px-8 md:py-14">
      <nav
        aria-label="Breadcrumb"
        className="flex items-center gap-1.5 text-sm text-muted-foreground"
      >
        <Link href="/tours" className="transition-colors hover:text-foreground">
          {messages.tourDetail.sections.departures}
        </Link>
        <ChevronRightIcon className="size-3.5" aria-hidden="true" />
        <Link href={`/tours/${tour.slug}`} className="transition-colors hover:text-foreground">
          {t.backToTour}
        </Link>
      </nav>

      <header className="mt-6 flex flex-col gap-3">
        <h1 className="font-heading text-3xl font-semibold text-balance">{tour.title}</h1>
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          {routeChain(tour.destinations).map((d) => (
            <li key={d.slug} className="after:ml-2 after:content-['·'] last:after:content-['']">
              {d.name}
            </li>
          ))}
        </ol>
        <p className="text-sm text-muted-foreground">
          {messages.tourDetail.durationValue(tour.durationDays)} ·{' '}
          {messages.tourDetail.groupSize(tour.maxGroupSize)}
        </p>
      </header>

      <div className="mt-10">
        {/* `steps` chỉ render bên trong `BookingModes` khi mode là scheduled
            (Finding 4, vòng review 1) — Private là form hỏi báo giá, không có
            bước thanh toán nào để chỉ. */}
        <BookingModes
          tourId={tour.id}
          departures={tour.departures}
          maxGroupSize={tour.maxGroupSize}
          currency={tour.currency}
          defaultName={session.name ?? ''}
          defaultEmail={session.email}
          summaryTour={summaryTour}
          steps={<BookingSteps />}
        />
      </div>
    </div>
  );
}

/**
 * Chỉ báo hai bước ở đầu trang — RSC thuần, nội bộ file này (không đáng tách
 * riêng cho một khối tĩnh chỉ hai chấm). ① Trip details là bước ĐANG ở trên
 * trang này; ② Payment KHÔNG xảy ra trong app — nó là trang hosted của
 * Stripe/PayPal sau khi submit, nên chấm mờ + kèm ghi chú nhỏ giải thích.
 */
function BookingSteps() {
  const t = messages.booking.page;
  return (
    <div className="flex flex-col gap-1.5">
      <ol className="flex items-center gap-3" aria-label={t.title}>
        <li aria-current="step" className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="grid size-6 shrink-0 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
          >
            1
          </span>
          <span className="text-sm font-medium text-foreground">{t.steps.trip}</span>
        </li>
        <li aria-hidden="true" className="h-px w-8 shrink-0 bg-border sm:w-16" />
        <li className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="grid size-6 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
          >
            2
          </span>
          <span className="text-sm font-medium text-muted-foreground">{t.steps.payment}</span>
        </li>
      </ol>
      <p className="pl-9 text-xs text-muted-foreground">{t.paymentStepNote}</p>
    </div>
  );
}
