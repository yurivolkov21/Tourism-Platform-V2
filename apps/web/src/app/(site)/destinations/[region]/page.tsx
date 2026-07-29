import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RegionGallery } from '@/components/destinations/region-gallery';
import { RegionHero } from '@/components/destinations/region-hero';
import { RegionHighlights } from '@/components/destinations/region-highlights';
import { RegionIntro } from '@/components/destinations/region-intro';
import { RegionSignaturePostcards } from '@/components/destinations/region-signature-postcards';
import {
  RegionSignatureStats,
  type RegionStat,
} from '@/components/destinations/region-signature-stats';
import { RegionSignatureTimeline } from '@/components/destinations/region-signature-timeline';
import { RegionTours } from '@/components/destinations/region-tours';
import { RegionValueProps } from '@/components/destinations/region-value-props';
import { Reveal } from '@/components/motion/reveal';
import { regionTheme } from '@/lib/region-theme';
import { destinationsInRegion, regionBySlug, regionGlance, toursInRegion } from '@/lib/regions';
import { absoluteUrl } from '@/lib/site';
import { formatMoney } from '@/lib/tours';
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
 * Trang vùng `/destinations/[region]` — dựng lại theo TRANG VÙNG THẬT của Nexora
 * (user chốt 29/07 sau khi bác bản Task 5). Bảy khu, một thứ tự:
 *
 *  1. Hero (tile phủ scrim)      5. Tours (chip lọc + lưới, phân trang)
 *  2. Intro (chữ + bento ảnh)    6. Gallery (khảm 10 ô)
 *  3/4. Signature ↔ Highlights   7. Value props (băng cuối, nền vùng)
 *
 * Khu 8 của Nexora (`Plan your trip`) BỎ HẲN: nó là form gợi ý hành trình, thứ
 * capstone không-doanh-thu này không có backend để đỡ.
 *
 * Thứ tự khu 3/4 LẬT theo `regionTheme(key).signatureFirst`: miền Bắc mở màn
 * bằng băng số liệu tối rồi mới tới ba thẻ highlight; hai vùng kia ngược lại.
 * Đây là nhánh `isAdventure` của Nexora, giữ nguyên — nó khiến ba trang vùng
 * đọc khác nhau ngay từ cuộn đầu tiên thay vì chỉ đổi màu.
 *
 * HAI khu của Task 5 đã bị XOÁ cùng component của chúng (`region-glance`,
 * `place-card`): Nexora không có dải "at a glance" lẫn danh sách "places" dạng
 * hàng — địa điểm ở đó là TAB LỌC trong khu Tours. Hàm `regionGlance()` thì GIỮ,
 * nó nuôi hàng chip `tags` của khu intro và dải số liệu của khu signature.
 *
 * Server Component thuần — không `fetch`, không oRPC, dữ liệu từ mock (giai đoạn
 * static-first). `Reveal` tự mang `'use client'` nên bọc được từ đây.
 */
export default async function RegionPage({ params }: { params: Promise<{ region: string }> }) {
  const { region: slug } = await params;
  const region = regionBySlug(REGIONS, slug);
  if (!region) notFound();

  const t = messages.regionPage;
  const theme = regionTheme(region.key);
  const places = destinationsInRegion(REGIONS, DESTINATIONS, region.key);
  const tours = toursInRegion(REGIONS, DESTINATIONS, TOURS, region.key);
  const glance = regionGlance(tours);
  const signature = t.regions[region.key].signature;

  // ── Dải số liệu của khu Signature — DẪN XUẤT ở đây, không gõ tay trong i18n.
  // Nexora gõ tay bốn con số này, nên mỗi lần catalogue đổi là chữ sai âm thầm.
  // Mã tiền lấy từ chính tour của vùng, không phải hằng số 'USD' đặt cứng.
  const currency = tours[0]?.currency;
  const stats: RegionStat[] = [];
  if (glance && currency) {
    stats.push({ value: formatMoney(glance.fromPrice, currency), label: t.statLabels.from });
    // `Math.max` trên mảng rỗng trả -Infinity, nhưng `glance` khác null đã bảo
    // đảm có ít nhất một tour nên mảng này không rỗng.
    const longest = Math.max(...tours.map((tour) => tour.durationDays));
    stats.push({
      value: messages.toursPage.durationValue(longest),
      label: t.statLabels.longest,
    });
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

  // Biến thể Signature chọn bằng CẢ HAI điều kiện — bản đồ vùng→biến thể
  // (`regionTheme`) VÀ hình dạng copy thật sự có (`'timeline' in signature`).
  // Chỉ dựa vào bản đồ là hứa một khu mà i18n có thể không có dữ liệu; chỉ dựa
  // vào copy là để nội dung quyết bố cục. Nexora dùng đúng cặp điều kiện này.
  const signatureNode =
    theme.signature === 'timeline' && 'timeline' in signature ? (
      <RegionSignatureTimeline
        eyebrow={signature.eyebrow}
        heading={signature.heading}
        body={signature.body}
        timeline={signature.timeline}
      />
    ) : theme.signature === 'postcards' && 'postcards' in signature ? (
      <RegionSignaturePostcards
        eyebrow={signature.eyebrow}
        heading={signature.heading}
        body={signature.body}
        postcards={signature.postcards}
      />
    ) : (
      <RegionSignatureStats
        eyebrow={signature.eyebrow}
        heading={signature.heading}
        body={signature.body}
        points={signature.points}
        stats={stats}
      />
    );

  const highlightsNode = <RegionHighlights region={region} />;

  return (
    // `data-region` đặt trên MỘT div bọc TOÀN trang: lớp token `[data-region]`
    // phải gán `--region-*` trước khi bất kỳ khu nào đọc chúng (hero đọc
    // `--region-hero` qua scrim, chip tab đọc `--region-primary`).
    <div data-region={region.key}>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: nội dung tĩnh của mình, đã escape `<`
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd).replace(/</g, '\\u003c'),
        }}
      />

      {/* ── Khu 1 · Hero ── */}
      <Reveal>
        <RegionHero region={region} />
      </Reveal>

      {/* ── Khu 2 · Intro — `tags` dẫn xuất từ chuyên mục của tour trong vùng ── */}
      <Reveal>
        <RegionIntro
          region={region}
          tags={glance?.categories.map((category) => category.name) ?? []}
          places={places}
        />
      </Reveal>

      {/* ── Khu 3/4 · Signature ↔ Highlights, thứ tự theo `signatureFirst` ── */}
      {theme.signatureFirst ? (
        <>
          <Reveal>{signatureNode}</Reveal>
          <Reveal>{highlightsNode}</Reveal>
        </>
      ) : (
        <>
          <Reveal>{highlightsNode}</Reveal>
          <Reveal>{signatureNode}</Reveal>
        </>
      )}

      {/* ── Khu 5 · Tours — đích của neo `#tours` ở CTA khu intro ── */}
      <Reveal>
        <RegionTours
          tours={tours}
          places={places.map((place) => ({ slug: place.slug, name: place.name }))}
        />
      </Reveal>

      {/* ── Khu 6 · Gallery ── */}
      <Reveal>
        <RegionGallery region={region} />
      </Reveal>

      {/* ── Khu 7 · Value props — khu CUỐI, mang `data-flush-footer` ── */}
      <Reveal>
        <RegionValueProps />
      </Reveal>
    </div>
  );
}
