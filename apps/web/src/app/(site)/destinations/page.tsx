import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { ArrowRightIcon, ChevronRightIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { RegionCard } from '@/components/destinations/region-card';
import { TopoPattern } from '@/components/topo-pattern';
import { TourCard } from '@/components/tours/tour-card';
import { destinationsInRegion, toursInRegion } from '@/lib/regions';
import { absoluteUrl } from '@/lib/site';
import { DESTINATIONS } from '@/mocks/destinations';
import { REGIONS } from '@/mocks/regions';
import { TOURS } from '@/mocks/tours';

/**
 * Landing page `/destinations` — cổng khám phá theo vùng (spec §5.1, quyết
 * định 28/07 #1). BỐN khu, không phải "3 thẻ": Hero → 3 thẻ vùng → Featured
 * trips → CTA hỏi. Nexora có 8 khu; ba khu sau bị bỏ, ghi lý do để không ai
 * tưởng nhầm là thiếu sót:
 *  - `BestTime` / `TravelTips`: copy du lịch bịa (mùa nào đẹp, mẹo đi lại) —
 *    không field nào trong contract nói về mùa/thời tiết.
 *  - `Gallery` ảnh biên tập theo vùng: chưa có media cho destination (spec §8 #1).
 *  - `Testimonials`: trang chủ đã có nguyên khu này, lặp lại là độn cho dài.
 *
 * Trang là Server Component thuần (không `'use client'`/motion) — khác các
 * trang khác trong site vốn tách hero/CTA ra file `'use client'` riêng để có
 * animation; ở đây brief chỉ cho phép 3 file (`region-card.tsx` + spec +
 * `page.tsx`), nên hero/CTA render tĩnh ngay trong file này.
 */
export const metadata: Metadata = {
  title: 'Destinations — Tourism',
  description: messages.destinationsPage.heroSubtitle,
  // Canonical: cùng lý do /tours và /tours/[slug] đã thêm — mẫu /blog từng bỏ sót.
  alternates: { canonical: '/destinations' },
  openGraph: {
    title: messages.destinationsPage.heroTitle,
    description: messages.destinationsPage.heroSubtitle,
    type: 'website',
    url: absoluteUrl('/destinations'),
  },
};

export default function DestinationsPage() {
  const t = messages.destinationsPage;
  const cta = messages.enquiryCta;

  // Cờ biên tập, KHÔNG phải tín hiệu phổ biến — contract không có field nào đỡ
  // chữ "popular"/"most loved"/"traveller favourites" (spec Tours §8 #3). Đúng
  // 6 tour trong mock mang cờ này.
  const featured = TOURS.filter((tour) => tour.isFeatured);

  return (
    <>
      {/* ── Khu 1 · Hero tối + TopoPattern (tối đa 1 vị trí/trang) ── */}
      <section className="relative w-full overflow-hidden bg-hero px-4 pt-36 pb-14 text-hero-foreground md:px-16 md:pb-16 lg:px-24 xl:px-32">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-linear-to-br from-primary/15 via-transparent to-transparent"
        />
        {/* NGOÀI scope dark — biến thể `dark:` phải đọc theme của TRANG. */}
        <TopoPattern className="bg-primary opacity-[0.12] dark:opacity-[0.2]" />

        {/* `dark` chỉ bọc NỘI DUNG, không đặt lên <section>: nếu không, ở dark
            mode `bg-hero` bị đọc trong scope dark và hero trùng màu nền trang
            (lỗi đã sửa một lần ở ToursHero, đừng tái diễn). */}
        <div className="dark contents">
          <div className="relative z-10 mx-auto max-w-7xl">
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-1.5 text-sm text-muted-foreground"
            >
              <a href="/" className="transition-colors hover:text-foreground">
                Home
              </a>
              <ChevronRightIcon className="size-3.5" aria-hidden="true" />
              <span aria-current="page" className="text-foreground">
                {t.breadcrumbCurrent}
              </span>
            </nav>

            <h1 className="mt-8 max-w-3xl font-heading text-4xl leading-tight font-medium text-balance text-foreground md:text-5xl">
              {t.heroTitle}
            </h1>

            <p className="mt-4 max-w-2xl text-pretty text-muted-foreground">{t.heroSubtitle}</p>
          </div>
        </div>
      </section>

      {/* ── Khu 2 · 3 thẻ vùng, mỗi thẻ tint riêng qua data-region ── */}
      <section className="w-full px-4 py-16 md:px-16 lg:px-24 xl:px-32">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 md:grid-cols-3">
          {REGIONS.map((region) => (
            <RegionCard
              key={region.key}
              region={region}
              destinations={destinationsInRegion(REGIONS, DESTINATIONS, region.key)}
              tourCount={toursInRegion(REGIONS, DESTINATIONS, TOURS, region.key).length}
            />
          ))}
        </div>
      </section>

      {/* ── Khu 3 · Featured trips — ẨN CẢ KHU nếu rỗng, đừng render tiêu đề
          trơ trọi không có gì bên dưới. */}
      {featured.length > 0 ? (
        <section className="w-full bg-muted px-4 py-16 md:px-16 lg:px-24 xl:px-32">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="font-heading text-3xl font-medium text-foreground">
                  {t.featured.heading}
                </h2>
                <p className="mt-2 max-w-xl text-pretty text-muted-foreground">
                  {t.featured.subtitle}
                </p>
              </div>
              <a
                href="/tours"
                className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary hover:underline"
              >
                {t.featured.viewAll}
                <ArrowRightIcon aria-hidden="true" className="size-3.5" />
              </a>
            </div>

            <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((tour) => (
                <TourCard key={tour.slug} tour={tour} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ── Khu 4 · CTA hỏi → /contact, dùng ButtonLink (KHÔNG Button render={<a/>}) ── */}
      <section className="w-full px-4 py-20 md:px-16 lg:px-24 xl:px-32">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-5 rounded-3xl border border-border bg-card px-6 py-14 text-center">
          <h2 className="font-heading text-3xl font-medium text-foreground md:text-4xl">
            {cta.headings.destinations}
          </h2>
          <p className="max-w-xl text-pretty text-muted-foreground">{cta.subtitle}</p>
          <ButtonLink href="/contact" size="lg" className="mt-2">
            {cta.cta}
          </ButtonLink>
          <p className="text-xs text-muted-foreground">{cta.note}</p>
        </div>
      </section>
    </>
  );
}
