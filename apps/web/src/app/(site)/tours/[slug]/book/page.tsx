import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { ChevronRightIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookingWizard } from '@/components/booking/booking-wizard';
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

  // Còn ít nhất một đợt đặt được không. `BookingModes` cũ tự rơi về nhánh Private
  // khi hết sạch chỗ; nay hai nhánh ở hai trang nên hành vi đó phải dựng lại
  // TƯỜNG MINH ở đây, nếu không khách vào đây gặp một wizard rỗng.
  const bookable = tour.departures.some((d) => d.seatsLeft > 0);

  return (
    // `pt-36` mượn ĐÚNG hằng số `account/layout.tsx` dùng để né navbar `fixed`
    // (site-header.tsx: `fixed top-(--banner-offset)`) — trang này không có
    // hero thật để ăn khoảng đó, thiếu bước bù thì breadcrumb/tiêu đề chui
    // dưới navbar khi cuộn lên đầu trang (lộ ra ở ảnh nghiệm thu book-light.png).
    <div className="mx-auto w-full max-w-6xl px-4 pt-36 pb-10 md:px-8 md:pb-14">
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
        {bookable ? (
          <BookingWizard
            departures={tour.departures}
            maxGroupSize={tour.maxGroupSize}
            currency={tour.currency}
            durationDays={tour.durationDays}
            defaultName={session.name ?? ''}
            defaultEmail={session.email}
            summaryTour={summaryTour}
            included={tour.included}
            excluded={tour.excluded}
          />
        ) : (
          <SoldOut slug={tour.slug} />
        )}
      </div>
    </div>
  );
}

/**
 * Tour đã bán hết mọi đợt — KHÔNG dựng wizard rỗng.
 *
 * Thay hành vi tự-rơi-về-Private của `BookingModes` (gỡ 19/08 khi hai nhánh
 * tách trang). Khách vẫn tới được nhánh khả thi, chỉ khác đường đi: một khối
 * giải thích cộng CTA sang `/enquire` — trang công khai, không cần đăng nhập.
 */
function SoldOut({ slug }: { slug: string }) {
  const t = messages.booking.wizard.soldOut;
  return (
    <div className="rounded-2xl border bg-card p-8 text-center">
      <h2 className="font-heading text-xl font-semibold">{t.heading}</h2>
      <p className="mx-auto mt-2 max-w-prose text-sm text-pretty text-muted-foreground">{t.body}</p>
      <ButtonLink className="mt-6" href={`/tours/${slug}/enquire`}>
        {t.cta}
      </ButtonLink>
    </div>
  );
}
