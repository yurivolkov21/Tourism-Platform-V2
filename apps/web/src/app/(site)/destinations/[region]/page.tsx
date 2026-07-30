import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { RegionDayTrips } from '@/components/destinations/region-day-trips';
import { RegionDays } from '@/components/destinations/region-days';
import { RegionGallery } from '@/components/destinations/region-gallery';
import { RegionHero, type RegionStat } from '@/components/destinations/region-hero';
import { RegionIntro } from '@/components/destinations/region-intro';
import { RegionReviews } from '@/components/destinations/region-reviews';
import { RegionSeasons } from '@/components/destinations/region-seasons';
import { RegionSignaturePostcards } from '@/components/destinations/region-signature-postcards';
import { RegionSignatureTimeline } from '@/components/destinations/region-signature-timeline';
import { RegionTours } from '@/components/destinations/region-tours';
import { Reveal } from '@/components/motion/reveal';
import { type RegionSectionKey, regionTheme } from '@/lib/region-theme';
import {
  destinationsInRegion,
  longestTourInRegion,
  ownToursInRegion,
  regionBySlug,
  regionGlance,
  reviewsInRegion,
  toursInRegion,
} from '@/lib/regions';
import { absoluteUrl } from '@/lib/site';
import { formatMoney } from '@/lib/tours';
import { DESTINATIONS } from '@/mocks/destinations';
import { REGIONS } from '@/mocks/regions';
import { TOUR_REVIEWS } from '@/mocks/tour-reviews';
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
 * Trang vùng `/destinations/[region]` — **7 khu mỗi miền, 6 khu riêng** (Task 5k,
 * vòng thiết kế thứ TƯ; user chốt 30/07).
 *
 * Thứ tự khu KHÔNG viết cứng ở đây: trang lặp `regionTheme(key).sections` và
 * `switch` sang component tương ứng. Bản đồ đầy đủ ba miền cùng lý do từng khu nằm
 * ở JSDoc `THEMES` trong `lib/region-theme.ts` — đọc ở đó, đừng nhân bản bảng sang
 * đây rồi để hai bản trôi khỏi nhau.
 *
 * Ràng buộc user chốt: giống hệt cả ba miền chỉ có **hero · lưới 6 tour card ·
 * footer**; mỗi miền BẮT BUỘC có gallery riêng khác bố cục; **số khu bằng nhau, 7
 * mỗi miền**. `region-theme.spec.ts` canh cả bốn điều đó, cộng một test đọc chính
 * file này để bắt ca "thêm khoá vào `sections` mà quên lắp nhánh render".
 *
 * ⚠️ Ba vòng thiết kế trước bị bác, và lần thứ ba đắt nhất: khu phổ ngày × độ khó
 * là một BIỂU ĐỒ trên trang bán tour — *"khách du lịch vào trang này để tham khảo
 * xem những gì đặc sắc có ở miền bắc, nhưng ập vào mặt là một cái đồ thị. Đây là
 * trang giao diện web cho người dùng xem chứ đâu phải dashboard báo cáo dành cho
 * admin."* Luật rút ra, áp cho mọi khu thêm về sau: phân hoá vùng nói bằng ngôn ngữ
 * KHÁCH DU LỊCH (nơi chốn, ảnh, lời người đã đi, "bạn có mấy ngày"), không bằng
 * ngôn ngữ phân tích dữ liệu.
 *
 * ⚠️ `data-flush-footer` đã XOÁ cả hai nửa (thuộc tính ở đây và luật
 * `body:has(main [data-flush-footer]) footer` ở cuối `globals.css`). Nó tồn tại vì
 * khu CUỐI từng là một băng nền tối; nay khu cuối của cả ba miền (`seasons`,
 * `dayTrips`, `reviews`) đều dùng nền trang nên 128px margin của footer lại vô hình
 * như 11 trang khác. Giữ một cơ chế không còn consumer là để lại bẫy.
 *
 * Khu 8 của Nexora (`Plan your trip`) BỎ HẲN: nó là form gợi ý hành trình, thứ
 * capstone không-doanh-thu này không có backend để đỡ. Khu `We've got you covered`
 * (value props) BỎ ở Task 5k: nó giống hệt ở cả ba miền và không nói gì về vùng,
 * nên nó ăn một trong bảy chỗ mà không trả lại gì.
 *
 * Server Component thuần — không `fetch`, không oRPC, dữ liệu từ mock (giai đoạn
 * static-first). `Reveal` tự mang `'use client'` nên bọc được từ đây.
 */
export default async function RegionPage({ params }: { params: Promise<{ region: string }> }) {
  const { region: slug } = await params;
  const found = regionBySlug(REGIONS, slug);
  if (!found) notFound();
  // Gán lại vào một const ĐÃ hẹp kiểu: `renderSection` bên dưới là một closure, và
  // TS không giữ phép hẹp kiểu từ `if (!found) notFound()` vào trong thân closure —
  // dùng `found` ở đó là `MockRegion | undefined` mỗi lần.
  const region = found;

  const t = messages.regionPage;
  const theme = regionTheme(region.key);
  const places = destinationsInRegion(REGIONS, DESTINATIONS, region.key);
  const tours = toursInRegion(REGIONS, DESTINATIONS, TOURS, region.key);
  const glance = regionGlance(tours);
  const copy = t.regions[region.key];
  // Miền Bắc KHÔNG có khối `signature` (khu riêng của nó là mùa và "mấy ngày"), nên
  // phải hỏi trước khi lấy — `t.regions[key]` là union ba hình dạng, không phải một
  // kiểu duy nhất.
  const signature = 'signature' in copy ? copy.signature : null;

  // Chuyến dài nhất RIÊNG của vùng — nuôi ô "Longest trip" của hàng số liệu trong
  // hero.
  const longestTour = longestTourInRegion(REGIONS, DESTINATIONS, tours, region.key);

  // Chuyến RIÊNG của vùng — nguồn của khu "bạn có mấy ngày" và khu chuyến-một-ngày.
  // `tours` (gom theo `some()`) KHÔNG dùng được cho hai khu đó: nó kéo theo
  // `north-to-south-classic` 12 ngày, thứ có mặt ở cả ba vùng, và trên khu "mấy
  // ngày" nó sẽ nhảy vào nhóm "một tuần trên đường" của cả ba miền. CÙNG một định
  // nghĩa với `longestTourInRegion` ở trên — cả hai đi qua `ownToursInRegion`, và
  // `regions.spec.ts` canh chuyện đó.
  const ownTours = ownToursInRegion(REGIONS, DESTINATIONS, tours, region.key);

  // Review của vùng — đi qua `toursInRegion` (CÙNG tập với lưới 6 tour card bên
  // dưới), nên review của tour xuyên vùng cũng thuộc đây. Xem JSDoc
  // `reviewsInRegion` cho lý do và cho con số đo được.
  const reviews = reviewsInRegion(REGIONS, DESTINATIONS, TOURS, TOUR_REVIEWS, region.key);

  // ── Hàng số liệu của HERO — DẪN XUẤT ở đây, không gõ tay trong i18n.
  // Nexora gõ tay bốn con số này, nên mỗi lần catalogue đổi là chữ sai âm thầm.
  // Mã tiền lấy từ chính tour của vùng, không phải hằng số 'USD' đặt cứng.
  const currency = tours[0]?.currency;
  const stats: RegionStat[] = [];
  if (glance && currency) {
    stats.push({ value: formatMoney(glance.fromPrice, currency), label: t.statLabels.from });

    // Không có chuyến riêng nào (nhánh có thật khi gắn API: một vùng mới chỉ được
    // ghé qua bởi tour liên vùng) thì BỎ HẲN ô này — mượn số của tour xuyên vùng
    // là nói sai, còn in "0 days" thì vô nghĩa.
    if (longestTour) {
      stats.push({
        value: messages.toursPage.durationValue(longestTour.durationDays),
        label: t.statLabels.longest,
      });
    }
    // `difficulties` đã được `regionGlance()` sắp theo bậc tăng dần nên phần tử
    // cuối là bậc nặng nhất. Mảng rỗng (mọi tour có `difficulty` null — nhánh có
    // thật khi gắn API) thì bỏ hẳn ô này thay vì in "undefined".
    const hardest = glance.difficulties[glance.difficulties.length - 1];
    if (hardest) {
      stats.push({
        value: messages.toursPage.difficultyLabels[hardest],
        label: t.statLabels.hardest,
      });
    }
    stats.push({ value: String(glance.categories.length), label: t.statLabels.styles });
  }

  // BreadcrumbList 3 cấp KHỚP breadcrumb đang hiện trong hero: Home → All
  // destinations → tên vùng. Escape `<` để chuỗi không thoát khỏi thẻ script —
  // cùng pattern an toàn với /blog/[slug] và /faq.
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: messages.common.home, item: absoluteUrl('/') },
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

  /**
   * Một khoá `sections` → một khu.
   *
   * Trả `null` là hợp lệ và có hai nguồn: (a) copy của vùng không có khối khu này
   * cần (`heritage` đòi `signature.timeline`), (b) chính component tự ẩn khi dữ liệu
   * không đủ (`days`, `dayTrips`, `reviews`). Cả hai đều là quyết định "dữ liệu
   * quyết nội dung, bản đồ quyết thứ tự" — bản đồ một mình có thể hứa một khu mà
   * dữ liệu không nuôi được.
   *
   * ⚠️ Thêm khoá vào `RegionSectionKey` mà quên thêm `case` ở đây thì khu BIẾN MẤT
   * im lặng — trang vẫn dựng, chỉ thiếu một băng. `region-theme.spec.ts` đọc chính
   * file này và đòi có `case '<key>':` cho mọi khoá đang dùng.
   */
  function renderSection(key: RegionSectionKey): ReactNode {
    switch (key) {
      case 'intro':
        return (
          <RegionIntro
            region={region}
            variant={theme.introVariant}
            tags={glance?.categories.map((category) => category.name) ?? []}
            highlights={copy.highlights}
          />
        );
      case 'gallery':
        return <RegionGallery region={region} variant={theme.galleryVariant} />;
      case 'tours':
        return (
          <RegionTours
            tours={tours}
            places={places.map((place) => ({ slug: place.slug, name: place.name }))}
          />
        );
      case 'heritage':
        return signature && 'timeline' in signature ? (
          <RegionSignatureTimeline
            eyebrow={signature.eyebrow}
            heading={signature.heading}
            body={signature.body}
            timeline={signature.timeline}
          />
        ) : null;
      case 'worlds':
        return signature && 'postcards' in signature ? (
          // `emphasis` CHỈ ở đây: khu này là lời mở đầu bằng ảnh của trang Nam (khu
          // đầu tiên sau hero), nên nó dựng cao hơn cỡ thường.
          <RegionSignaturePostcards
            emphasis
            eyebrow={signature.eyebrow}
            heading={signature.heading}
            body={signature.body}
            postcards={signature.postcards}
          />
        ) : null;
      case 'days':
        return <RegionDays tours={ownTours} />;
      case 'dayTrips':
        return <RegionDayTrips tours={ownTours} />;
      case 'seasons':
        // Vùng chưa có copy mùa (nhánh có thật khi gắn API) thì khu BỎ HẲN — mượn
        // mùa của vùng khác là nói sai về thời tiết.
        return 'season' in copy ? (
          <RegionSeasons
            regionName={region.name}
            months={copy.season.months}
            note={copy.season.note}
          />
        ) : null;
      case 'reviews':
        return <RegionReviews regionName={region.name} reviews={reviews} />;
    }
  }

  return (
    // Fragment, KHÔNG một `<div data-region>` bọc toàn trang như trước: thuộc tính
    // đó chỉ tồn tại để mở scope cho lớp tint `[data-region]`, mà ADR-0015 đã rút
    // lớp ấy — mọi khu của trang giờ đọc thẳng token brand.
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: nội dung tĩnh của mình, đã escape `<`
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, '\\u003c'),
        }}
      />

      {/* ── Khu 1 · Hero — giống hệt ở cả ba miền, và KHÔNG bọc `Reveal`: hero tự
          chạy animate lúc mount (nó ở màn đầu). Bọc thêm một lớp `whileInView` là
          hai nhịp chồng nhau, và `Reveal` để `opacity: 0` cho tới khi viewport
          observer bắn — trên màn đầu thì đó là một khoảnh khắc trắng không lý do.
          Badge pill lấy HAI chuyên mục đầu, không cả danh sách: miền Bắc có bốn, và
          bốn chuyên mục trong một viên pill thì nó dài bằng cả dòng tagline. ── */}
      <RegionHero
        region={region}
        tagline={copy.tagline}
        styles={(glance?.categories ?? [])
          .slice(0, 2)
          .map((category) => category.name)
          .join(' · ')}
        stats={stats}
      />

      {/* ── Khu 2–6 · năm khu GIỮA, thứ tự riêng từng miền ──
          `null` (dữ liệu không đủ nuôi khu) thì KHÔNG bọc `Reveal` quanh nó:
          `Reveal` là một `motion.div` có thật và một cái rỗng vẫn ăn chỗ trong
          luồng. ── */}
      {theme.sections.map((key) => {
        const node = renderSection(key);
        return node ? <Reveal key={key}>{node}</Reveal> : null;
      })}

      {/* ── Khu 7 · Footer — do layout dùng chung lo, giống hệt ở cả ba miền ── */}
    </>
  );
}
