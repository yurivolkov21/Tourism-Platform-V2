import { messages } from '@tourism/i18n';
import { ChevronRightIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { JourneyMoments } from '@/components/destinations/journey-moments';
import { KnowBeforeYouGo } from '@/components/destinations/know-before-you-go';
import { RegionGroup } from '@/components/destinations/region-group';
import { TravellerQuotes } from '@/components/destinations/traveller-quotes';
import { LoadErrorState } from '@/components/feedback/load-error-state';
import { Reveal } from '@/components/motion/reveal';
import { TopoPattern } from '@/components/topo-pattern';
import { contentState, settle } from '@/lib/api/resilience';
import { fetchDestinations, fetchTours } from '@/lib/api/tours';
import { destinationsInRegion, featuredInRegion, toursInRegion } from '@/lib/regions';
import { absoluteUrl } from '@/lib/site';
import { FAQ_ITEMS } from '@/mocks/faq';
import { MOMENTS } from '@/mocks/moments';
import { REGIONS } from '@/mocks/regions';
import { TESTIMONIALS } from '@/mocks/testimonials';

export const revalidate = 300; // ADR-0016 §3 — khớp REVALIDATE_SEC của fetchTours/fetchDestinations

/**
 * Landing page `/destinations` — cổng khám phá theo vùng (spec §5.1). NĂM khu
 * (Task 4c, thiết kế lại LẦN HAI sau khi user chỉ vào bản Nexora): Hero → 3
 * `RegionGroup` (header căn giữa + dải ảnh full-bleed) → Moments from the
 * journey → Loved by travellers → Know before you go.
 *
 * HAI khu đã bị BỎ, cả hai theo quyết định của user 28/07:
 *  · `Featured trips` — trang này giới thiệu vùng, không bán tour.
 *  · CTA hỏi ("Not sure where to begin?") — nó chỉ là vài dòng chữ căn giữa,
 *    không đủ thành một khu; và nền `bg-muted/30` của nó tạo hai dải màu sát
 *    nhau ngay trên footer, đọc rời rạc. Copy vẫn nằm ở `messages.enquiryCta`
 *    cho component `EnquiryCta` dùng chung khi nào dựng thật (nợ đã ghi từ cụm
 *    pháp lý) — khối đó có sẵn biến thể tiêu đề cho home/faq/about/blog và
 *    `regionHeading` cho trang vùng.
 *
 * Chữ ký của trang giờ là DẢI ẢNH FULL-BLEED sát mép màn hình dưới mỗi header
 * vùng, các ô giãn ra khi hover — KHÔNG còn đường kinh tuyến dọc của Task 4b
 * (bản đó đã bị bác: dải ảnh chạy sát mép nên không còn chỗ cho một đường kẻ
 * dọc bên trái, giữ cả hai là nhồi hai chữ ký vào một khu). Vẫn giữ nguyên
 * quy ước không đánh số `01/02/03` — ba vùng không phải các bước tuần tự.
 *
 * Trang vẫn là Server Component thuần (không `'use client'` trên chính
 * `page.tsx`, `metadata` giữ nguyên). `Reveal` (`@/components/motion/reveal`,
 * tự mang `'use client'`) bọc NGOÀI từng khu (kể cả `<section>` nền tint của
 * từng khu) để cả khu — kể cả nền — trồi lên cùng lúc khi cuộn tới. Mỗi
 * `RegionGroup`/khu tự mang `<section>` full-bleed riêng (nền tint theo vùng
 * ở khối header, hoặc `bg-hero`), nên không có một `<section>` nền chung nào
 * để nhúng Reveal vào bên trong.
 */
export const metadata: Metadata = {
  title: 'Destinations — Tourism',
  description: messages.destinationsPage.heroSubtitleMeta,
  // Canonical: cùng lý do /tours và /tours/[slug] đã thêm — mẫu /blog từng bỏ sót.
  alternates: { canonical: '/destinations' },
  openGraph: {
    title: messages.destinationsPage.heroTitle,
    description: messages.destinationsPage.heroSubtitleMeta,
    type: 'website',
    url: absoluteUrl('/destinations'),
  },
};

export default async function DestinationsPage() {
  const t = messages.destinationsPage;

  // settle() không bao giờ throw — hai fetch chạy song song, mỗi cái tự đứng
  // độc lập (ADR-0016 §4, cùng khuôn /tours và /blog). Ở trang này CẢ HAI đều
  // nuôi khu 2 (destination lẫn tourCount), nên MỘT trong hai fail là đủ để
  // coi khu 2 lỗi — khác /tours nơi destination chỉ là facet phụ.
  const [toursRes, destinationsRes] = await Promise.all([
    settle(fetchTours()),
    settle(fetchDestinations()),
  ]);
  // `isEmpty` cố tình luôn false: trang này không có màn rỗng riêng cho khu 2
  // (khác listing) — 3 vùng luôn có ít nhất một destination trong seed thật.
  const state = contentState({ failed: !toursRes.ok || !destinationsRes.ok, isEmpty: false });
  const tours = toursRes.data ?? [];
  const destinations = destinationsRes.data ?? [];

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
          {/* Một `Reveal` cho cả khối hero (breadcrumb + h1 + subtitle đi cùng
              nhau) — không tách từng dòng như `ToursHero`, vì brief chỉ cần
              khối này KHÔNG còn đứng yên, không cần tái tạo stagger tinh vi
              của trang tour listing. */}
          <Reveal className="relative z-10 mx-auto max-w-7xl">
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

            <p className="mt-4 max-w-2xl text-pretty text-muted-foreground">
              {t.heroSubtitle(destinations.length)}
            </p>
          </Reveal>
        </div>
      </section>

      {/* ── Khu 2 · Ba `RegionGroup`, Bắc → Trung → Nam — thứ tự là thông tin
          thật, không phải trang trí. Mỗi group tự mang `<section>` full-bleed
          riêng (nền tint theo vùng ở khối header), nên `Reveal` bọc NGOÀI
          từng group thay vì bọc div nội dung bên trong một section nền
          chung.

          Tri-state (ADR-0016 §4): tours HOẶC destinations lỗi → thay TOÀN khu
          bằng `LoadErrorState` — CẤM hiện 2/3 vùng rồi im lặng thiếu vùng thứ
          ba, và CẤM tourCount tính từ dữ liệu rỗng (đọc như "0 tour" thật).
          Hero (khu 1) + khu 3–5 KHÔNG phụ thuộc API, giữ nguyên bên dưới dù
          nhánh này rơi vào lỗi. */}
      {state === 'error' ? (
        <div className="w-full px-4 py-16 md:px-16 md:py-20 lg:px-24 xl:px-32">
          <div className="mx-auto max-w-7xl">
            <LoadErrorState />
          </div>
        </div>
      ) : (
        REGIONS.map((region, i) => (
          <Reveal key={region.key} delay={i === 0 ? 0.1 : 0}>
            <RegionGroup
              region={region}
              destinations={featuredInRegion(
                destinationsInRegion(REGIONS, destinations, region.key),
              )}
              tourCount={toursInRegion(REGIONS, destinations, tours, region.key).length}
            />
          </Reveal>
        ))
      )}

      {/* ── Khu 3 · Moments from the journey — băng tối, khảm ảnh + caption ── */}
      <Reveal>
        <JourneyMoments moments={MOMENTS} />
      </Reveal>

      {/* ── Khu 4 · Loved by travellers — carousel MỘT trích dẫn một lúc (kiểu
          Nexora), khác marquee 2 cột của trang chủ ── */}
      <Reveal>
        <TravellerQuotes testimonials={TESTIMONIALS} />
      </Reveal>

      {/* ── Khu 5 · Know before you go — FAQ có thật, kèm link /faq ── */}
      <Reveal>
        <KnowBeforeYouGo items={FAQ_ITEMS} />
      </Reveal>
    </>
  );
}
