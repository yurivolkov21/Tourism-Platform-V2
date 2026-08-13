import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TopoPattern } from '@/components/topo-pattern';
import { DepartureDialog } from '@/components/tours/departure-dialog';
import {
  BookingRailConnected,
  DepartureSelectionProvider,
  DepartureStripConnected,
} from '@/components/tours/departure-selection';
import { DeparturesPanel } from '@/components/tours/panels/departures-panel';
import { GoodToKnowPanel } from '@/components/tours/panels/good-to-know-panel';
import { ItineraryPanel } from '@/components/tours/panels/itinerary-panel';
import { OverviewPanel } from '@/components/tours/panels/overview-panel';
import { ReviewsPanel } from '@/components/tours/panels/reviews-panel';
import { RelatedTours } from '@/components/tours/related-tours';
import { TourHero } from '@/components/tours/tour-hero';
import { TourMediaPanel } from '@/components/tours/tour-media-panel';
import { TourTabs } from '@/components/tours/tour-tabs';
import { fetchTourDetail, fetchTourReviews, fetchTours } from '@/lib/api/tours';
import { absoluteUrl } from '@/lib/site';
import { slugify } from '@/lib/slug';
import { relatedTours } from '@/lib/tours';

// Cùng cửa sổ revalidate với cụm blog (ADR-0016 §3, 300s) — một hằng số cho
// mọi trang đọc catalog, đổi là đổi ở một chỗ.
export const revalidate = 300;

/**
 * ⚠️ ĐỪNG THÊM `loading.tsx` vào route này, cũng đừng thêm vào segment cha
 * `/tours` — nếu thêm, `notFound()` dưới đây thành SOFT 404.
 *
 * Đo được 27/07 (cả `next dev` lẫn production build): chỉ cần có `loading.tsx` ở
 * segment này HOẶC ở `/tours` là slug lạ trả **HTTP 200** kèm giao diện 404.
 * `loading.tsx` tạo Suspense boundary → Next stream shell ra trước → status line
 * 200 đã gửi xong trước khi thân trang kịp gọi `notFound()`. Crawler nhận 200 và
 * đem trang lỗi đi index — đúng route mà Task 11 sắp đưa vào sitemap.
 *
 * Vì thế skeleton của listing nằm trong route group `(listing)/` chứ không nằm
 * ở `tours/`: route group không đổi URL (`/tours` vẫn là `/tours`) nhưng
 * `loading.tsx` trong đó KHÔNG bọc `[slug]`. Trang detail hiện là SSG tĩnh nên
 * không cần skeleton — nó về ngay dưới dạng HTML.
 *
 * Đã thử và KHÔNG ăn: `export const dynamicParams = false`. Nó chỉ đổi nơi phát
 * sinh 404 chứ 404 đó vẫn đi qua cùng cây segment có Suspense boundary — đo được
 * vẫn 200. Nó cũng gài bẫy cho lúc gắn API (tour mới publish sẽ 404 tới lần build
 * kế), nên đã bỏ hẳn.
 *
 * KHI GẮN API (task 9): đã đo lại — slug lạ vẫn 404 THẬT (không phải soft-404)
 * sau khi đổi nguồn, cùng lần thay đổi này (xem docs/CHANGELOG.md).
 */
// Sinh sẵn ~30 slug lúc build từ API THẬT (ADR-0016 §3), KHÔNG settle lỗi ở
// đây: fetch hỏng lúc build phải ném ra ngoài → build fail TO TIẾNG. Settle êm
// ở đây là slug rỗng âm thầm → sitemap/ISR rỗng âm thầm, lỗi chỉ lộ ra khi
// người dùng vào trang 404 nhầm chỗ. Slug lạ ngoài danh sách này vẫn rơi vào
// notFound() bên dưới. Cùng khuôn với /blog/[slug], chỉ khác nguồn dữ liệu.
export async function generateStaticParams() {
  const tours = await fetchTours();
  return tours.map((tour) => ({ slug: tour.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  // React cache() dedupe: cùng slug với thân trang bên dưới chỉ tốn một fetch.
  const tour = await fetchTourDetail(slug);
  if (!tour) return { title: 'Tour not found — Tourism' };

  // summary nullable — mô tả rơi về một câu dựng từ field có thật, không để
  // description rỗng (crawler sẽ tự bốc một đoạn bất kỳ trên trang).
  const description =
    tour.summary ??
    `A ${tour.durationDays}-day ${tour.category.name.toLowerCase()} trip with Tourism.`;

  return {
    title: `${tour.title} — Tourism`,
    description,
    // Canonical: mẫu /blog bỏ sót cái này so với Nexora. Trang tour có thể tới
    // kèm query param theo dõi nên càng cần.
    alternates: { canonical: `/tours/${tour.slug}` },
    openGraph: {
      title: tour.title,
      description,
      type: 'website',
      url: absoluteUrl(`/tours/${tour.slug}`),
    },
  };
}

/**
 * TRANG NÀY KHÔNG CÒN MỤC LỤC (`OnThisPage`).
 *
 * Dải năm tab thay vai mục lục: giữ cả hai là dựng hai bộ điều hướng cho cùng
 * một tập nội dung, và bộ thứ hai trỏ vào các `<section id>` không còn tồn tại.
 * `OnThisPage` vẫn sống ở `/blog` — không xoá component.
 *
 * Anchor cũ (`#itinerary`, `#departures`, `#reviews`, `#good-to-know`) KHÔNG
 * chết: `TourTabs` đọc hash lúc mount và nghe `hashchange`, nên link đã chia sẻ
 * mở đúng tab tương ứng thay vì cuộn tới một section. Xem ADR-0022.
 */
export default async function TourDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tour = await fetchTourDetail(slug);
  if (!tour) notFound();

  const t = messages.tourDetail;

  // Cùng slug với `relatedTours()` bên dưới nên tận dụng luôn — danh sách
  // ĐẦY ĐỦ (không phải trang hiện tại) vì gợi ý cuối trang cần xét mọi tour
  // khác để chọn cùng chuyên mục/destination. Cùng pattern `fetchPosts()` gọi
  // lại ở thân `/blog/[slug]` dù `generateStaticParams` đã gọi một lần.
  const [tours, reviewsPage] = await Promise.all([fetchTours(), fetchTourReviews(slug)]);

  return (
    <DepartureSelectionProvider departures={tour.departures}>
      {/* ── "Departure board": hero + dải khởi hành là MỘT mặt, không hai băng ──
          Ý định từ đầu (Task 9) là hai băng liền màu, cách nhau một hairline, đọc
          thành một bảng có đường chia — thay vì một khối lạ trôi trên nền sáng.
          Nhưng lúc đó nền và lớp vân vẫn nằm trên TỪNG section, nên vân dừng đúng
          tại vạch chia: đo được hero phủ y 0–580 có vân, dải y 580–763 không, mà
          màu nền hai bên GIỐNG NHAU tuyệt đối (`lab(13.19 -5.13 -0.19)`). Hệ quả
          là các đường đồng mức bị cắt ngang GIỮA NÉT ở vạch chia — người xem đọc
          thành lỗi render, không phải chủ ý (user hỏi đúng chỗ này 28/07).

          Nên nền + vân hoist lên đây, phủ liên tục cả hai tấm. Vẫn đúng luật
          "tối đa MỘT vị trí topo mỗi trang" (25/07): đây là một instance, chỉ là
          nó phủ trọn bảng. Cố tình KHÔNG thêm `TopoPattern` thứ hai vào dải —
          `mask-size: cover` tính theo hộp, nên instance riêng trên hộp cao 183px
          crop và scale khác hộp 580px, các đường sẽ LỆCH nhau tại vạch ghép, tệ
          hơn cả để phẳng.

          Vân ở NGOÀI mọi scope `dark` để biến thể `dark:` đọc theme của TRANG:
          nền tối hơn ở dark mode nên vân phải đậm lên mới đọc được. `bg-hero`
          cũng phải ở ngoài scope `dark` — đặt trong đó thì nó trùng màu nền trang
          ở dark mode (lỗi đã sửa `22bd75e`). */}
      <div className="relative overflow-hidden bg-hero text-hero-foreground">
        <TopoPattern className="bg-primary opacity-[0.12] dark:opacity-[0.2]" />

        <TourHero tour={tour} />

        {/* `relative z-10` là BẮT BUỘC, không phải trang trí: lớp vân là phần tử
            absolute, còn section này nếu để static thì theo thứ tự vẽ của CSS nó
            nằm DƯỚI phần tử positioned cùng stacking context — tức vân sẽ phủ lên
            chính các chip khởi hành. Hero không cần thêm vì nội dung nó đã có
            `relative z-10` sẵn.
            Dải phải ở trên nếp gấp: dữ liệu đợt khởi hành là thứ Nexora không có
            (họ hardcode `departures: []`). */}
        <section
          aria-labelledby="departure-strip-heading"
          className="relative z-10 w-full border-t border-hero-foreground/15 px-4 py-6 md:px-16 lg:px-24 xl:px-32"
        >
          <div className="dark contents">
            <div className="mx-auto max-w-7xl">
              {/* Nhãn trái, link xuống bảng đầy đủ phải — cùng hình dạng "tiêu đề
                khu vực + điều khiển đuôi" mà listing chốt ở vòng 4. Không có nó
                thì nửa phải của băng trống hoác đúng kiểu ba bản listing đầu. */}
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                <p
                  id="departure-strip-heading"
                  className="font-mono text-xs tracking-widest text-muted-foreground uppercase"
                >
                  {t.departures.stripHeading}
                </p>
                {/* Chỉ hiện khi có đợt: link tới một bảng rỗng là link nói dối. */}
                {tour.departures.length > 0 ? (
                  <a
                    href={`#${slugify(t.sections.departures)}`}
                    className="text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                  >
                    {t.departures.seeAll(tour.departures.length)}
                  </a>
                ) : null}
              </div>
              <DepartureStripConnected currency={tour.currency} />
            </div>
          </div>
        </section>
      </div>

      {/* Khung 1152 với đệm ngang 24 → nội dung ĐÚNG 1104px. Con số đó không
          phải thẩm mỹ: lưới trên chia 1104 thành 621 | 40 | 443, cột phải GHIM
          443px (không phải `1.4fr/1fr`) nên ảnh vuông ra 541 chẵn. Tỉ lệ fr chia
          ra 620.656 | 443.328 và phần lẻ .656 truyền xuống cả trang, làm mọi
          đường kẻ 1px bị khử răng cưa thành dày-mỏng xen kẽ (đo được ở bản demo:
          `tabs` bắt đầu tại 911.656). Xem spec §2.1. */}
      <div className="mx-auto w-full max-w-6xl px-6 py-14">
        <TourMediaPanel tour={tour} />

        {/* MỘT instance duy nhất cho cả trang: cả ô "All N dates" ở panel đặt chỗ
            lẫn nút "See all dates" ở tab Departures đều mở modal này qua
            `openAllDates()` trong context. */}
        <DepartureDialog currency={tour.currency} />

        <div className="mt-14">
          <TourTabs
            panels={{
              overview: <OverviewPanel tour={tour} />,
              // `live={false}` cho tới khi trang biết session: chế độ live chỉ
              // được bật khi khách CÓ booking PAID ở đúng đợt này, mà trang này
              // là SSG công khai nên không tra được. `today` vẫn truyền vào cho
              // đủ chữ ký — ở chế độ xem trước nó không được đọc tới.
              itinerary: <ItineraryPanel tour={tour} live={false} today={new Date()} />,
              departures: <DeparturesPanel tour={tour} />,
              reviews: <ReviewsPanel tour={tour} page={reviewsPage} />,
              goodToKnow: <GoodToKnowPanel tour={tour} />,
            }}
          />
        </div>
      </div>

      <section aria-labelledby="related-heading" className="mx-auto w-full max-w-6xl px-6 pb-24">
        <h2 id="related-heading" className="mb-8 font-heading text-2xl font-medium text-foreground">
          {t.sections.related}
        </h2>
        <RelatedTours tours={relatedTours(tours, tour.slug, 3)} />
      </section>

      {/* Bar đáy dính chỉ có dưới lg (điều kiện nằm trong component). Đệm bên
          dưới để bar không che mất hàng cuối trước footer — cùng lớp lỗi với đợt
          vá "đệm footer" ở vòng test listing. */}
      <div aria-hidden="true" className="h-24 lg:hidden" />
      <BookingRailConnected
        slug={tour.slug}
        variant="bar"
        currency={tour.currency}
        basePrice={tour.basePrice}
        durationDays={tour.durationDays}
        maxGroupSize={tour.maxGroupSize}
      />
    </DepartureSelectionProvider>
  );
}
