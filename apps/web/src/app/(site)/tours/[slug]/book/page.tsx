import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { BookingWizard } from '@/components/booking/booking-wizard';
import type { CheckoutSummaryTour } from '@/components/booking/checkout-summary';
import { TourHeroBoard } from '@/components/tours/tour-hero-board';
import { requireSession } from '@/lib/api/session';
import { fetchTourDetail } from '@/lib/api/tours';

export const metadata: Metadata = {
  title: `${messages.booking.page.title} — Nexora`,
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
    // Hero THẬT từ 19/08 (user chốt) thay cho `pt-36` bù khoảng: hero tự mang
    // `pt-36` nên navbar `fixed` có nền tối để đứng lên, và `site-header.tsx`
    // không còn phải dò đường dẫn để nhận ra trang này.
    <>
      <TourHeroBoard tour={tour} />

      <div className="mx-auto w-full max-w-6xl px-4 pt-10 pb-10 md:px-8 md:pb-14">
        {bookable ? (
          <BookingWizard
            departures={tour.departures}
            maxGroupSize={tour.maxGroupSize}
            currency={tour.currency}
            durationDays={tour.durationDays}
            defaultName={session.name ?? ''}
            defaultEmail={session.email}
            summaryTour={summaryTour}
          />
        ) : (
          <SoldOut slug={tour.slug} />
        )}
      </div>
    </>
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
