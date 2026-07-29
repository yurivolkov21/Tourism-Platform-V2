import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { RegionGallery } from '@/components/destinations/region-gallery';
import { RegionHero, type RegionStat } from '@/components/destinations/region-hero';
import { RegionIntro } from '@/components/destinations/region-intro';
import { RegionSeasons } from '@/components/destinations/region-seasons';
import { RegionSignaturePostcards } from '@/components/destinations/region-signature-postcards';
import { RegionSignatureTimeline } from '@/components/destinations/region-signature-timeline';
import { RegionTours } from '@/components/destinations/region-tours';
import { RegionValueProps } from '@/components/destinations/region-value-props';
import { Reveal } from '@/components/motion/reveal';
import { regionTheme } from '@/lib/region-theme';
import {
  destinationsInRegion,
  longestTourInRegion,
  regionBySlug,
  regionGlance,
  toursInRegion,
} from '@/lib/regions';
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
 * (user chốt 29/07 sau khi bác bản Task 5). Sáu khu, một thứ tự CỐ ĐỊNH cho cả
 * ba vùng:
 *
 *  1. Hero (tile + scrim, kiểu About)   4. Tours (chip lọc + lưới, phân trang)
 *  2. Intro (chữ + 3 highlight)         5. Gallery (khảm 10 ô)
 *  3. Signature (biến thể theo vùng)    6. Value props (băng cuối, nền vùng)
 *
 * Khu 8 của Nexora (`Plan your trip`) BỎ HẲN: nó là form gợi ý hành trình, thứ
 * capstone không-doanh-thu này không có backend để đỡ.
 *
 * Khu `What makes {region} special` của Nexora KHÔNG còn đứng riêng (29/07):
 * user duyệt khu 2 và chỉ ra bento ảnh của Intro là ảnh LẶP LẠI (gallery khu 5
 * đã là khu ảnh riêng) — bento bị bỏ, ba thẻ highlight của khu kia GỘP vào cột
 * phải của Intro thay chỗ bento. Hệ quả: nhánh `isAdventure`/`signatureFirst`
 * của Nexora (lật thứ tự Signature ↔ Highlights cho miền Bắc) hết đối tượng để
 * lật — đã bỏ khỏi `regionTheme`. Signature giờ LUÔN theo ngay sau Intro, cả
 * ba vùng đọc cùng một thứ tự.
 *
 * HAI khu của Task 5 đã bị XOÁ cùng component của chúng (`region-glance`,
 * `place-card`): Nexora không có dải "at a glance" lẫn danh sách "places" dạng
 * hàng — địa điểm ở đó là TAB LỌC trong khu Tours. Hàm `regionGlance()` thì GIỮ,
 * nó nuôi hàng chip `tags` của khu intro, badge pill và hàng số liệu của hero.
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
  const copy = t.regions[region.key];
  // Miền Bắc KHÔNG còn khối `signature` (khu của nó giờ là dải mùa, đọc từ
  // `copy.season`), nên phải hỏi trước khi lấy — `t.regions[key]` là union ba
  // hình dạng, không phải một kiểu duy nhất.
  const signature = 'signature' in copy ? copy.signature : null;

  // Chuyến dài nhất RIÊNG của vùng — nuôi ô "Longest trip" của hàng số liệu
  // trong hero. (Trước 29/07 nó nuôi thêm khu Signature itinerary của miền Bắc;
  // khu đó đã bỏ, ô số liệu thì còn.)
  const longestTour = longestTourInRegion(REGIONS, DESTINATIONS, tours, region.key);

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

  // Biến thể Signature chọn bằng CẢ HAI điều kiện — bản đồ vùng→biến thể
  // (`regionTheme`) VÀ hình dạng dữ liệu thật sự có. Chỉ dựa vào bản đồ là hứa
  // một khu mà dữ liệu có thể không có; chỉ dựa vào dữ liệu là để nội dung quyết
  // bố cục. Nexora dùng đúng cặp điều kiện này.
  //
  // Biến thể `seasons` cần khối `season` của vùng. Không có (nhánh có thật khi
  // gắn API: một vùng mới chưa có copy mùa) thì `signatureNode` là `null` và khu
  // BỎ HẲN — mượn mùa của vùng khác là nói sai về thời tiết.
  const signatureNode =
    theme.signature === 'timeline' && signature && 'timeline' in signature ? (
      <RegionSignatureTimeline
        eyebrow={signature.eyebrow}
        heading={signature.heading}
        body={signature.body}
        timeline={signature.timeline}
      />
    ) : theme.signature === 'postcards' && signature && 'postcards' in signature ? (
      <RegionSignaturePostcards
        eyebrow={signature.eyebrow}
        heading={signature.heading}
        body={signature.body}
        postcards={signature.postcards}
      />
    ) : theme.signature === 'seasons' && 'season' in copy ? (
      // Không truyền `eyebrow`/`heading`: khu này KHÔNG dùng copy `signature`
      // riêng từng vùng nữa mà dùng nhãn chung `seasonsEyebrow`/`seasonsHeading`
      // — tiêu đề sinh từ tên vùng nên không thể trôi khỏi nội dung như
      // "Great northern adventures" đã trôi.
      <RegionSeasons regionName={region.name} months={copy.season.months} note={copy.season.note} />
    ) : null;

  // Badge pill của hero: HAI chuyên mục đầu của vùng, nối bằng ` · `. Hai chứ
  // không phải cả danh sách — miền Bắc có bốn, và bốn chuyên mục trong một viên
  // pill thì nó dài bằng cả dòng tagline ngay dưới. Vùng chưa có tour nào thì
  // chuỗi rỗng và hero bỏ hẳn pill.
  const styles = (glance?.categories ?? [])
    .slice(0, 2)
    .map((category) => category.name)
    .join(' · ');

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

      {/* ── Khu 1 · Hero — KHÔNG bọc `Reveal`: hero tự chạy animate lúc mount
          (nó ở màn đầu). Bọc thêm một lớp `whileInView` là hai nhịp chồng nhau,
          và `Reveal` để `opacity: 0` cho tới khi viewport observer bắn — trên màn
          đầu thì đó là một khoảnh khắc trắng không lý do. ── */}
      <RegionHero
        region={region}
        tagline={t.regions[region.key].tagline}
        styles={styles}
        stats={stats}
      />

      {/* ── Khu 2 · Intro — `tags` dẫn xuất từ chuyên mục của tour trong vùng.
          `highlights` là khu `What makes X special` cũ của Nexora, GỘP vào cột
          phải của Intro (29/07) — không còn đứng riêng nên không cần `Reveal`
          thứ hai cho nó. ── */}
      <Reveal>
        <RegionIntro
          region={region}
          tags={glance?.categories.map((category) => category.name) ?? []}
          highlights={t.regions[region.key].highlights}
        />
      </Reveal>

      {/* ── Khu 3 · Signature — LUÔN theo sau Intro, cả ba vùng (29/07: Highlights
          không còn là khu riêng để "lật thứ tự" với Signature nữa, nên nhánh
          `signatureFirst` của Nexora đã bỏ). `signatureNode` có thể là `null`
          (vùng không có tour riêng để nuôi itinerary) — khi đó KHÔNG bọc `Reveal`
          quanh nó, vì `Reveal` là một `motion.div` có thật và một cái rỗng vẫn ăn
          chỗ trong luồng. ── */}
      {signatureNode ? <Reveal>{signatureNode}</Reveal> : null}

      {/* ── Khu 4 · Tours — đích của neo `#tours` ở CTA khu intro ── */}
      <Reveal>
        <RegionTours
          tours={tours}
          places={places.map((place) => ({ slug: place.slug, name: place.name }))}
        />
      </Reveal>

      {/* ── Khu 5 · Gallery ── */}
      <Reveal>
        <RegionGallery region={region} />
      </Reveal>

      {/* ── Khu 6 · Value props — khu CUỐI, mang `data-flush-footer` ── */}
      <Reveal>
        <RegionValueProps />
      </Reveal>
    </div>
  );
}
