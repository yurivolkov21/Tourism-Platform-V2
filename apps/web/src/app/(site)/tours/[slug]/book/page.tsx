import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { ChevronRightIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookingForm } from '@/components/booking/booking-form';
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
  const bookable = tour.departures.filter((d) => d.seatsLeft > 0);

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
        {tour.departures.length === 0 || bookable.length === 0 ? (
          /* Tour chưa mở đợt nào (hoặc đã kín chỗ hết). Chế độ Private trip —
             gửi `enquiries.create` — là slice kế tiếp; TRONG LÚC ĐÓ chỉ đường
             sang /contact (trang có thật) chứ KHÔNG để khách ở ngõ cụt. Cùng
             luật "không đẩy user vào 404" mà `booking-rail.tsx` đã lập. */
          <div className="flex max-w-xl flex-col gap-4 rounded-2xl border bg-card p-6">
            <h2 className="font-heading text-lg font-semibold">
              {messages.tourDetail.departures.none}
            </h2>
            <p className="text-sm text-pretty text-muted-foreground">
              {messages.booking.form.modeToggle.noDepartures}
            </p>
            <div className="flex flex-wrap gap-2.5">
              <ButtonLink href="/contact">{messages.tourDetail.booking.ask}</ButtonLink>
              <ButtonLink variant="outline" href={`/tours/${tour.slug}`}>
                {t.backToTour}
              </ButtonLink>
            </div>
          </div>
        ) : (
          <BookingForm
            departures={tour.departures}
            maxGroupSize={tour.maxGroupSize}
            currency={tour.currency}
            defaultName={session.name ?? ''}
            defaultEmail={session.email}
          />
        )}
      </div>
    </div>
  );
}
