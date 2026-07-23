import { ArrowRightIcon } from 'lucide-react';
import { Reveal } from '@/components/motion/reveal';
import { REGIONS } from '@/mocks/regions';

// Lớp tint vùng ra mắt: data-region đổi --region-* (page-level được phép dùng
// slot này — ADR-0013 #4). Chữ trên gradient dùng on-media (đáy gradient là
// region-primary đậm ở cả 3 vùng).
export function RegionsStrip() {
  return (
    <section id="regions" className="mx-auto w-full max-w-(--container-content) px-6 pb-20">
      <Reveal className="mb-8 flex flex-col gap-1">
        <p className="text-xs font-bold tracking-[0.16em] uppercase text-primary">
          Three regions, three moods
        </p>
        <h2 className="font-heading text-3xl font-semibold text-balance">
          Where will Vietnam take you?
        </h2>
      </Reveal>
      <div className="grid gap-6 md:grid-cols-3">
        {REGIONS.map((region, i) => (
          <Reveal key={region.key} delay={i * 0.1}>
            <a
              href="#regions"
              data-region={region.key}
              className="region-card group flex min-h-56 flex-col justify-end gap-1 rounded-xl p-6 text-on-media transition-transform duration-300 hover:-translate-y-1"
            >
              <h3 className="font-heading text-2xl font-semibold">{region.name}</h3>
              <p className="text-sm opacity-90">{region.tagline}</p>
              <p className="mt-2 flex items-center gap-1 text-sm font-semibold">
                {region.tourCount} tours
                <ArrowRightIcon
                  className="size-4 transition-transform group-hover:translate-x-1"
                  aria-hidden="true"
                />
              </p>
            </a>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
