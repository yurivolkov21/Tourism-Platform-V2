import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { TourCard } from '@/components/tours/tour-card';
import { ToursHero } from '@/components/tours/tours-hero';
import { DESTINATIONS } from '@/mocks/destinations';
import { TOURS } from '@/mocks/tours';

export const metadata: Metadata = {
  title: 'Tours — Tourism',
  description: messages.toursPage.subtitle,
  // Canonical: mẫu /blog bỏ sót cái này so với Nexora. Trang listing sẽ có
  // ?category=&destination=&page= nên càng cần trỏ về bản không tham số.
  alternates: { canonical: '/tours' },
};

export default function ToursPage() {
  return (
    <>
      <ToursHero
        eyebrow={messages.toursPage.resultSummary(TOURS.length, DESTINATIONS.length)}
        title={messages.toursPage.title}
        subtitle={messages.toursPage.subtitle}
      />

      <div className="w-full px-4 py-16 md:px-16 md:py-20 lg:px-24 xl:px-32">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TOURS.map((tour) => (
            <TourCard key={tour.slug} tour={tour} />
          ))}
        </div>
      </div>
    </>
  );
}
