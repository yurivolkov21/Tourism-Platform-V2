import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { ChevronRightIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PlaceCard } from '@/components/destinations/place-card';
import { RegionGlanceBar } from '@/components/destinations/region-glance';
import { SectionEyebrow } from '@/components/home/section-eyebrow';
import { Reveal } from '@/components/motion/reveal';
import { TopoPattern } from '@/components/topo-pattern';
import { TourCard } from '@/components/tours/tour-card';
import { destinationsInRegion, regionBySlug, regionGlance, toursInRegion } from '@/lib/regions';
import { absoluteUrl } from '@/lib/site';
import { DESTINATIONS } from '@/mocks/destinations';
import { REGIONS } from '@/mocks/regions';
import { TOURS } from '@/mocks/tours';

/**
 * ⚠️ ĐỪNG THÊM `loading.tsx` vào route này, cũng đừng thêm vào segment cha
 * `/destinations` — nếu thêm, `notFound()` dưới đây thành SOFT 404.
 *
 * Đo được 27/07 ở `/tours/[slug]` (cả `next dev` lẫn production build): chỉ cần
 * có `loading.tsx` ở segment này HOẶC ở segment cha là slug lạ trả **HTTP 200**
 * kèm giao diện 404. `loading.tsx` tạo Suspense boundary → Next stream shell ra
 * trước → status line 200 đã gửi xong trước khi thân trang kịp gọi `notFound()`.
 * Cụm này đưa 4 URL vào sitemap nên hậu quả y hệt: crawler nhận 200 và đem trang
 * lỗi đi index.
 */
// Sinh sẵn 3 slug lúc build; slug lạ rơi vào notFound() → trang 404 chung đón.
export function generateStaticParams() {
  return REGIONS.map((region) => ({ region: region.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string }>;
}): Promise<Metadata> {
  const { region: slug } = await params;
  const region = regionBySlug(REGIONS, slug);
  // Slug lạ: TRẢ title "not found", KHÔNG gọi `notFound()` ở đây — cùng khuôn
  // `/tours/[slug]` và `/blog/[slug]`. Chính thân trang mới là nơi 404.
  if (!region) return { title: 'Region not found — Tourism' };

  const description = messages.regionPage.regions[region.key].intro;

  return {
    title: `${region.name} — Tourism`,
    description,
    alternates: { canonical: `/destinations/${region.slug}` },
    openGraph: {
      title: region.name,
      description,
      type: 'website',
      url: absoluteUrl(`/destinations/${region.slug}`),
    },
  };
}

/**
 * Trang vùng `/destinations/[region]` — đích của link "View more" trên
 * `/destinations` (spec §5.2, bản 29/07 sau bốn quyết định của user).
 *
 * BỐN KHU, một thứ tự: hero (kèm rail at-a-glance) → PLACES → TRIPS → băng CTA.
 * Bản Task 5 cũ (4 khu xếp chồng, PLACES là 3 thẻ, không có băng CTA) đã bị
 * thay hẳn:
 *  · Rail số liệu nằm TRONG hero, không phải một băng riêng — nó là ngữ cảnh
 *    của tiêu đề vùng, không phải một khu độc lập.
 *  · PLACES là 3 HÀNG rộng kẻ mảnh — hình dạng thứ ba của cụm (dải ảnh
 *    full-bleed đã là chữ ký `/destinations`, thẻ có khung là của listing), và
 *    là thứ duy nhất còn chỗ cho `description` ở trạng thái nghỉ.
 *  · CÓ băng CTA cuối trên nền `--region-hero` — khác `/destinations` (nơi CTA
 *    bị bỏ vì chỉ là vài dòng chữ trên `bg-muted/30` sát footer); ở đây nó đóng
 *    khung trang bằng đúng màu vùng đã mở đầu.
 *
 * Server Component thuần — không `fetch`, không oRPC, dữ liệu từ mock (giai
 * đoạn static-first). `Reveal` tự mang `'use client'` nên bọc được từ đây.
 */
export default async function RegionPage({ params }: { params: Promise<{ region: string }> }) {
  const { region: slug } = await params;
  const region = regionBySlug(REGIONS, slug);
  if (!region) notFound();

  const t = messages.regionPage;
  const places = destinationsInRegion(REGIONS, DESTINATIONS, region.key);
  const tours = toursInRegion(REGIONS, DESTINATIONS, TOURS, region.key);
  const glance = regionGlance(tours);
  // Mã tiền lấy từ chính tour của vùng, KHÔNG hằng số 'USD' đặt cứng: khi gắn
  // API mà catalogue đổi tiền tệ thì rail phải đi theo. Vùng chưa có tour nào
  // thì `glance` cũng đã là null nên rail ẩn hẳn — hai điều kiện luôn cùng nhau.
  const currency = tours[0]?.currency;

  // BreadcrumbList 3 cấp KHỚP breadcrumb đang hiện trong hero: Home → All
  // destinations → tên vùng. Escape `<` để chuỗi không thoát khỏi thẻ script —
  // cùng pattern an toàn với /blog/[slug] và /faq.
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: absoluteUrl('/') },
      {
        '@type': 'ListItem',
        position: 2,
        name: t.backToAll,
        item: absoluteUrl('/destinations'),
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: region.name,
        item: absoluteUrl(`/destinations/${region.slug}`),
      },
    ],
  };

  return (
    // `data-region` đặt trên MỘT div bọc TOÀN trang: lớp token `[data-region]`
    // phải gán `--region-*` trước khi bất kỳ khu nào đọc chúng (hero đọc
    // `--region-hero`, PlaceCard đọc `--region-primary`).
    <div data-region={region.key}>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: nội dung tĩnh của mình, đã escape `<`
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, '\\u003c'),
        }}
      />

      {/* ── Khu 1 · Hero tint theo vùng + rail at-a-glance ── */}
      <section
        style={{ background: 'var(--region-hero)' }}
        className="relative w-full overflow-hidden px-4 pt-36 pb-14 text-hero-foreground md:px-16 md:pb-16 lg:px-24 xl:px-32"
      >
        {/* NGOÀI scope dark — biến thể `dark:` phải đọc theme của TRANG. */}
        <TopoPattern className="bg-primary opacity-[0.12] dark:opacity-[0.2]" />

        {/* `dark` chỉ bọc NỘI DUNG, KHÔNG đặt lên <section>: nếu đặt lên
            section thì ở dark mode hero trùng màu nền trang (lỗi đã sửa một lần
            ở ToursHero và một lần nữa ở hero /destinations — đừng tái diễn). */}
        <div className="dark contents">
          <Reveal className="relative z-10 mx-auto max-w-7xl">
            <nav
              aria-label="Breadcrumb"
              className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground"
            >
              <a href="/" className="transition-colors hover:text-foreground">
                Home
              </a>
              <ChevronRightIcon className="size-3.5" aria-hidden="true" />
              <a href="/destinations" className="transition-colors hover:text-foreground">
                {t.backToAll}
              </a>
              <ChevronRightIcon className="size-3.5" aria-hidden="true" />
              <span aria-current="page" className="text-foreground">
                {region.name}
              </span>
            </nav>

            <h1 className="mt-8 max-w-3xl font-heading text-4xl leading-tight font-medium text-balance text-foreground md:text-5xl">
              {region.name}
            </h1>

            {/* `tagline` chứ KHÔNG phải `intro`: intro là đoạn dẫn của khu
                PLACES bên dưới, in cả hai chỗ là lặp nguyên một câu trên cùng
                một màn hình. */}
            <p className="mt-4 max-w-2xl text-pretty text-muted-foreground">{region.tagline}</p>

            {glance && currency ? <RegionGlanceBar glance={glance} currency={currency} /> : null}
          </Reveal>
        </div>
      </section>

      {/* ── Khu 2 · PLACES — 3 hàng rộng kẻ mảnh ── */}
      <Reveal>
        <section className="w-full px-4 py-16 md:px-16 md:py-20 lg:px-24 xl:px-32">
          <div className="mx-auto max-w-7xl">
            <SectionEyebrow>{messages.destinationsPage.placesLabel}</SectionEyebrow>
            <h2 className="mt-4 max-w-3xl font-heading text-3xl leading-tight font-medium text-foreground md:text-[40px]/12">
              {t.placesHeading(region.name)}
            </h2>
            {/* Cùng câu `intro` đang hiện dưới header vùng ở `/destinations` —
                CỐ Ý một nguồn duy nhất, không tạo key i18n thứ hai. */}
            <p className="mt-3 max-w-2xl text-pretty text-muted-foreground">
              {t.regions[region.key].intro}
            </p>

            {/* Vạch ngăn do container vẽ (`divide-y`), không để từng hàng tự vẽ
                viền dưới — nếu không hàng cuối thừa một vạch. */}
            <div className="mt-10 divide-y divide-border border-y border-border">
              {places.map((place) => (
                <PlaceCard key={place.slug} destination={place} />
              ))}
            </div>
          </div>
        </section>
      </Reveal>

      {/* ── Khu 3 · TRIPS — lưới TourCard, dùng lại nguyên khuôn related-tours ── */}
      <Reveal>
        <section className="w-full px-4 pb-16 md:px-16 md:pb-20 lg:px-24 xl:px-32">
          <div className="mx-auto max-w-7xl">
            <SectionEyebrow>{t.toursCount(tours.length)}</SectionEyebrow>
            <h2 className="mt-4 max-w-3xl font-heading text-3xl leading-tight font-medium text-foreground md:text-[40px]/12">
              {t.toursHeading(region.name)}
            </h2>

            {tours.length === 0 ? (
              // Nhánh có thật khi gắn API (vùng mới chưa có tour publish). Đưa
              // người đọc sang `/contact` — trang CÓ THẬT, không dựng form ở đây.
              <div className="mt-6 max-w-2xl">
                <p className="text-muted-foreground">{t.noTours}</p>
                <p className="mt-2 text-pretty text-muted-foreground">{t.noToursBody}</p>
                <ButtonLink href="/contact" className="mt-6">
                  {messages.enquiryCta.cta}
                </ButtonLink>
              </div>
            ) : (
              <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
                {tours.map((tour) => (
                  <TourCard key={tour.slug} tour={tour} />
                ))}
              </div>
            )}
          </div>
        </section>
      </Reveal>

      {/* ── Khu 4 · Băng CTA vùng — đóng khung trang bằng đúng màu đã mở đầu ── */}
      <Reveal>
        <section
          style={{ background: 'var(--region-hero)' }}
          className="w-full px-4 py-16 text-hero-foreground md:px-16 md:py-20 lg:px-24 xl:px-32"
        >
          {/* Cùng cảnh báo với hero: `dark` bọc NỘI DUNG, không đặt lên section. */}
          <div className="dark contents">
            <div className="mx-auto flex max-w-2xl flex-col items-center gap-4 text-center">
              <h2 className="font-heading text-3xl leading-tight font-medium text-balance text-foreground md:text-[40px]/12">
                {messages.enquiryCta.regionHeading(region.name)}
              </h2>
              <p className="text-pretty text-muted-foreground">{messages.enquiryCta.subtitle}</p>
              {/* `outline` chứ KHÔNG phải variant mặc định, và đây là chỗ ĐO ĐƯỢC
                  chứ không phải chuyện gu: cặp `--primary-foreground` trên
                  `--primary` chỉ đạt 5.52:1 ở light và **4.11:1 ở dark**. Nút này
                  nằm trong scope `dark` nên nó đọc cặp dark ở CẢ HAI theme của
                  trang → 4.11:1, dưới ngưỡng AA 4.5 cho chữ 14px.
                  Đo bằng canvas (vẽ màu computed rồi đọc pixel sRGB), KHÔNG bằng
                  regex `rgb()` — trình duyệt trả `lab()` và regex cho ra số bịa.
                  4.11:1 ở dark mode là lỗi CÓ SẴN của token, áp cho MỌI nút
                  `bg-primary` toàn site — đã ghi nợ riêng, sửa nó là đổi tầng
                  token nên cần ADR. Ở đây chỉ tránh khối chữ trắng-trên-teal
                  trượt ngưỡng ngay giữa băng tối. */}
              <ButtonLink href="/contact" variant="outline" className="mt-2">
                {messages.enquiryCta.cta}
              </ButtonLink>
            </div>
          </div>
        </section>
      </Reveal>
    </div>
  );
}
