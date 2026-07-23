import { ArrowRightIcon } from 'lucide-react';
import { Reveal } from '@/components/motion/reveal';
import { TOURS } from '@/mocks/tours';
import { TourCard } from './tour-card';

export function FeaturedTours() {
  return (
    <section id="tours" className="mx-auto w-full max-w-(--container-content) px-6 py-20">
      <Reveal className="mb-8 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-bold tracking-[0.16em] uppercase text-primary">This season</p>
          <h2 className="font-heading text-3xl font-semibold text-balance">
            Tours travelers keep coming back to
          </h2>
        </div>
        <a
          href="#tours"
          className="ml-auto flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
        >
          View all 68 tours
          <ArrowRightIcon className="size-4" aria-hidden="true" />
        </a>
      </Reveal>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {TOURS.map((tour, i) => (
          <Reveal key={tour.slug} delay={(i % 3) * 0.08}>
            <TourCard tour={tour} />
          </Reveal>
        ))}
      </div>
    </section>
  );
}
