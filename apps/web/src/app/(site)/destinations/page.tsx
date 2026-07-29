import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { ChevronRightIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { JourneyMoments } from '@/components/destinations/journey-moments';
import { KnowBeforeYouGo } from '@/components/destinations/know-before-you-go';
import { RegionGroup } from '@/components/destinations/region-group';
import { TravellerQuotes } from '@/components/destinations/traveller-quotes';
import { Reveal } from '@/components/motion/reveal';
import { TopoPattern } from '@/components/topo-pattern';
import { destinationsInRegion, toursInRegion } from '@/lib/regions';
import { absoluteUrl } from '@/lib/site';
import { DESTINATIONS } from '@/mocks/destinations';
import { FAQ_ITEMS } from '@/mocks/faq';
import { MOMENTS } from '@/mocks/moments';
import { REGIONS } from '@/mocks/regions';
import { TESTIMONIALS } from '@/mocks/testimonials';
import { TOURS } from '@/mocks/tours';

/**
 * Landing page `/destinations` — cổng khám phá theo vùng (spec §5.1). SÁU khu
 * (Task 4c, thiết kế lại LẦN HAI sau khi user chỉ vào bản Nexora): Hero → 3
 * `RegionGroup` (header căn giữa + dải ảnh full-bleed) → Moments from the
 * journey → Loved by travellers → Know before you go → CTA hỏi. Khu
 * `Featured trips` của bản đầu đã BỎ — trang này giới thiệu vùng, không bán
 * tour (user quyết 28/07).
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

            <p className="mt-4 max-w-2xl text-pretty text-muted-foreground">{t.heroSubtitle}</p>
          </Reveal>
        </div>
      </section>

      {/* ── Khu 2 · Ba `RegionGroup`, Bắc → Trung → Nam — thứ tự là thông tin
          thật, không phải trang trí. Mỗi group tự mang `<section>` full-bleed
          riêng (nền tint theo vùng ở khối header), nên `Reveal` bọc NGOÀI
          từng group thay vì bọc div nội dung bên trong một section nền
          chung. */}
      {REGIONS.map((region, i) => (
        <Reveal key={region.key} delay={i === 0 ? 0.1 : 0}>
          <RegionGroup
            region={region}
            destinations={destinationsInRegion(REGIONS, DESTINATIONS, region.key)}
            tourCount={toursInRegion(REGIONS, DESTINATIONS, TOURS, region.key).length}
          />
        </Reveal>
      ))}

      {/* ── Khu 3 · Moments from the journey — băng tối, khảm ảnh + caption ── */}
      <Reveal>
        <JourneyMoments moments={MOMENTS} />
      </Reveal>

      {/* ── Khu 4 · Loved by travellers — 3 trích dẫn lớn, khác marquee trang chủ ── */}
      <Reveal>
        <TravellerQuotes testimonials={TESTIMONIALS} />
      </Reveal>

      {/* ── Khu 5 · Know before you go — FAQ có thật, kèm link /faq ── */}
      <Reveal>
        <KnowBeforeYouGo items={FAQ_ITEMS} />
      </Reveal>

      {/* ── Khu 6 · CTA hỏi → /contact ──
          Là BĂNG full-width, KHÔNG phải thẻ có viền. Bản đầu bọc nội dung trong
          `rounded-3xl border bg-card max-w-3xl` — nó thành thứ DUY NHẤT trên
          trang có khung, và là thứ duy nhất không dùng chiều rộng nội dung của
          trang, nên đọc như một widget lạc vào chứ không phải một khu của trang
          (user chỉ ra 28/07).
          `border-t` nhắc lại vạch mảnh mà dải ảnh vùng đã dùng, và `bg-muted/30`
          tách nó khỏi hai khu nền trắng ngay trên — nếu không, ba khu liền nhau
          cùng nền sẽ dính thành một khối.
          KHÔNG bê nguyên banner tối của `home/call-to-action.tsx`: trang chủ đã
          có đúng banner đó, lặp y hệt thì đọc như bản sao. */}
      <section className="w-full border-t border-border bg-muted/30 px-4 py-20 md:px-16 lg:px-24 xl:px-32">
        <Reveal className="mx-auto flex max-w-3xl flex-col items-center gap-5 text-center">
          <h2 className="font-heading text-3xl leading-tight font-medium text-foreground md:text-[40px]/12">
            {cta.headings.destinations}
          </h2>
          <p className="max-w-xl text-pretty text-muted-foreground">{cta.subtitle}</p>
          {/* `rounded-full` nhắc lại kiểu nút viên thuốc của CTA trang chủ —
              mượn NGÔN NGỮ nút, không mượn cả banner. */}
          <ButtonLink href="/contact" size="lg" className="mt-2 rounded-full px-8">
            {cta.cta}
          </ButtonLink>
          <p className="text-xs text-muted-foreground">{cta.note}</p>
        </Reveal>
      </section>
    </>
  );
}
