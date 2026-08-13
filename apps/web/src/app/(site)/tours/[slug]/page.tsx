import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { OnThisPage } from '@/components/content/on-this-page';
import { TopoPattern } from '@/components/topo-pattern';
import {
  BookingRailConnected,
  DepartureSelectionProvider,
  DepartureStripConnected,
  DeparturesTableConnected,
} from '@/components/tours/departure-selection';
import { GoodToKnow } from '@/components/tours/good-to-know';
import { Inclusions } from '@/components/tours/inclusions';
import { ItineraryTimeline } from '@/components/tours/itinerary-timeline';
import { RelatedTours } from '@/components/tours/related-tours';
import { GoodFor, WhyThisTrip } from '@/components/tours/tour-facts';
import { TourGallery } from '@/components/tours/tour-gallery';
import { TourHero } from '@/components/tours/tour-hero';
import { TourReviews } from '@/components/tours/tour-reviews';
import { fetchTourDetail, fetchTourReviews, fetchTours, type TourDetailVM } from '@/lib/api/tours';
import { absoluteUrl } from '@/lib/site';
import { slugify } from '@/lib/slug';
import { tocFromSections } from '@/lib/toc';
import { relatedTours, routeChain } from '@/lib/tours';

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
 * Danh sách section CÓ MẶT trên trang này, theo đúng thứ tự render.
 *
 * Mục lục và các thẻ <section> dùng CHUNG mảng này nên chúng không thể lệch:
 * `tocFromSections` slugify chính chuỗi tiêu đề, và section gắn `id` bằng cùng
 * hàm `slugify`. Section điều kiện (tour không có highlights, không có
 * suitableFor) bị loại khỏi cả hai cùng lúc — rail trỏ vào mục không tồn tại là
 * lỗi im lặng khó thấy nhất của kiểu mục lục dựng tay.
 *
 * "You might also like" KHÔNG nằm trong danh sách: nó là gợi ý cuối trang, không
 * phải nội dung của tour này.
 */
type SectionKey =
  | 'why'
  | 'goodFor'
  | 'itinerary'
  | 'included'
  | 'departures'
  | 'reviews'
  | 'goodToKnow';

function pageSections(tour: TourDetailVM): { key: SectionKey; heading: string }[] {
  const s = messages.tourDetail.sections;
  return [
    tour.highlights.length > 0 ? { key: 'why' as const, heading: s.why } : null,
    tour.suitableFor.length > 0 ? { key: 'goodFor' as const, heading: s.goodFor } : null,
    { key: 'itinerary' as const, heading: s.itinerary },
    { key: 'included' as const, heading: s.included },
    { key: 'departures' as const, heading: s.departures },
    // Reviews đứng NGAY SAU đợt khởi hành, trước "Good to know": uy tín xã hội
    // thuộc gần chỗ ra quyết định (giá + ngày) hơn là sau phần điều khoản.
    // Section này luôn có mặt kể cả khi chưa review nào — khác `why`/`goodFor`:
    // trạng thái rỗng của nó là một lời mời hỏi, có giá trị riêng, không phải
    // một khung trống.
    { key: 'reviews' as const, heading: s.reviews },
    tour.faqs.length > 0 || tour.policies.length > 0
      ? { key: 'goodToKnow' as const, heading: s.goodToKnow }
      : null,
    // Khoá ổn định đi kèm tiêu đề: nội dung từng section chọn theo `key`, không
    // so sánh chuỗi tiêu đề — sửa một chữ trong copy không được làm nội dung
    // section biến mất.
  ].filter((section) => section !== null);
}

export default async function TourDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tour = await fetchTourDetail(slug);
  if (!tour) notFound();

  const t = messages.tourDetail;
  const sections = pageSections(tour);
  const toc = tocFromSections(sections.map(({ heading }) => ({ heading })));

  // Cùng slug với `relatedTours()` bên dưới nên tận dụng luôn — danh sách
  // ĐẦY ĐỦ (không phải trang hiện tại) vì gợi ý cuối trang cần xét mọi tour
  // khác để chọn cùng chuyên mục/destination. Cùng pattern `fetchPosts()` gọi
  // lại ở thân `/blog/[slug]` dù `generateStaticParams` đã gọi một lần.
  const [tours, reviewsPage] = await Promise.all([fetchTours(), fetchTourReviews(slug)]);

  return (
    <DepartureSelectionProvider departures={tour.departures} currency={tour.currency}>
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

      {/* Khảm ảnh THAY băng 21:9 full-bleed trước đây: băng đó chiếm 617px ở màn
          1440 mà không nói được gì ngoài "sẽ có ảnh ở đây". Khảm nằm trong
          max-w-7xl như mọi nội dung khác — trang đã có hai băng tối liên tiếp
          (hero + dải khởi hành), thêm băng thứ ba là quá nhiều.
          Nhãn ô lớn là tên điểm đến chính, KHÔNG phải tên tour: tên tour đã là H1.

          `media={[]}` CỐ Ý, không phải lỗ hổng: `TourDetailSchema` (catalog,
          P1) CHƯA có field media — ADR-0005 mới đặt nền cho posts/site-media,
          "tour media" được ghi rõ là module SAU kế thừa hợp đồng đó, chưa làm.
          `TourGallery` đã tự degrade sạch cho mảng rỗng (return null, không
          khung/không nút) nên không cần sửa gì ở component — chỉ cần không
          giả vờ có ảnh. Khi contract có `media`, đổi lại `tour.media` là đủ. */}
      <TourGallery media={[]} primaryLabel={routeChain(tour.destinations)[0]?.name} />

      <div className="w-full px-4 py-14 md:px-16 md:py-16 lg:px-24 xl:px-32">
        {/* Ba cột ở xl (rail · main · booking), hai cột ở lg (rail ẩn), một cột ở
            dưới lg. Rail để ĐẦU trong DOM nhưng `hidden` dưới xl: display:none
            loại nó khỏi luồng grid, nên ở lg thì main tự thành cột 1 và booking
            thành cột 2 — không cần đảo order.
            Bar dính đáy cho mobile là việc của Task 9. */}
        <div className="mx-auto flex max-w-7xl flex-col gap-12 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-12 xl:grid-cols-[12rem_minmax(0,1fr)_20rem] xl:gap-16">
          <aside className="hidden xl:block">
            <div className="xl:sticky xl:top-28">
              <OnThisPage items={toc} />
            </div>
          </aside>

          <main className="min-w-0">
            <div className="divide-y divide-border">
              {sections.map(({ key, heading }) => (
                <section
                  key={key}
                  id={slugify(heading)}
                  aria-labelledby={`${slugify(heading)}-heading`}
                  className="scroll-mt-28 py-10 first:pt-0"
                >
                  <h2
                    id={`${slugify(heading)}-heading`}
                    className="font-heading text-2xl leading-snug font-medium text-balance text-foreground"
                  >
                    {heading}
                  </h2>

                  {/* Nội dung chọn theo `key`, không theo chuỗi tiêu đề. Section
                      nào không có dữ liệu thì đã bị loại khỏi `sections` từ đầu,
                      nên ở đây không có nhánh rỗng nào. */}
                  {key === 'why' ? <WhyThisTrip highlights={tour.highlights} /> : null}
                  {key === 'goodFor' ? <GoodFor suitableFor={tour.suitableFor} /> : null}
                  {key === 'itinerary' ? (
                    <ItineraryTimeline days={tour.itinerary} meetingPoint={tour.meetingPoint} />
                  ) : null}
                  {key === 'included' ? (
                    <Inclusions included={tour.included} excluded={tour.excluded} />
                  ) : null}
                  {key === 'departures' ? (
                    <div className="mt-6">
                      <DeparturesTableConnected
                        currency={tour.currency}
                        durationDays={tour.durationDays}
                      />
                    </div>
                  ) : null}
                  {key === 'reviews' ? (
                    <TourReviews reviews={reviewsPage.items} ratingAvg={tour.ratingAvg} />
                  ) : null}
                  {key === 'goodToKnow' ? (
                    <GoodToKnow faqs={tour.faqs} policies={tour.policies} />
                  ) : null}
                </section>
              ))}
            </div>
          </main>

          <aside className="hidden lg:block">
            <BookingRailConnected
              slug={tour.slug}
              variant="rail"
              currency={tour.currency}
              basePrice={tour.basePrice}
              durationDays={tour.durationDays}
              maxGroupSize={tour.maxGroupSize}
            />
          </aside>
        </div>
      </div>

      <section
        aria-labelledby="related-heading"
        className="w-full px-4 pb-24 md:px-16 lg:px-24 xl:px-32"
      >
        <div className="mx-auto max-w-7xl">
          <h2
            id="related-heading"
            className="mb-8 font-heading text-2xl font-medium text-foreground"
          >
            {t.sections.related}
          </h2>
          <RelatedTours tours={relatedTours(tours, tour.slug, 3)} />
        </div>
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
