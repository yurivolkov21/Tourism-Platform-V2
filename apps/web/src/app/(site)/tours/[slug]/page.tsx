import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { OnThisPage } from '@/components/content/on-this-page';
import { TourHero, TourImageBand } from '@/components/tours/tour-hero';
import { absoluteUrl } from '@/lib/site';
import { slugify } from '@/lib/slug';
import { tocFromSections } from '@/lib/toc';
import { TOURS } from '@/mocks/tours';
import type { MockTourDetail } from '@/mocks/types';

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
 * KHI GẮN API: nếu muốn có skeleton cho trang detail thì phải đo lại status của
 * slug lạ ngay trong cùng lần thay đổi đó.
 */
// Sinh sẵn 16 slug lúc build; slug lạ rơi vào notFound() → trang 404 chung đón.
// Cùng khuôn với /blog/[slug], chỉ khác nguồn mock.
export function generateStaticParams() {
  return TOURS.map((tour) => ({ slug: tour.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tour = TOURS.find((t) => t.slug === slug);
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
function pageSections(tour: MockTourDetail): string[] {
  const s = messages.tourDetail.sections;
  return [
    tour.highlights.length > 0 ? s.why : null,
    tour.suitableFor.length > 0 ? s.goodFor : null,
    s.itinerary,
    s.included,
    s.departures,
    tour.faqs.length > 0 || tour.policies.length > 0 ? s.goodToKnow : null,
    // Không viết type predicate tường minh ở đây: `messages` là object const nên
    // tiêu đề mang kiểu literal union, và `heading is string` bị TS từ chối vì
    // rộng hơn chính tham số. Để TS tự suy diễn narrow từ phép so sánh.
  ].filter((heading) => heading !== null);
}

export default async function TourDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tour = TOURS.find((t) => t.slug === slug);
  if (!tour) notFound();

  const t = messages.tourDetail;
  const sections = pageSections(tour);
  const toc = tocFromSections(sections.map((heading) => ({ heading })));

  return (
    <>
      <TourHero tour={tour} />
      {/* Băng ảnh cắt ngang toàn chiều rộng, không có đệm hai bên — nó là đường
          phân cách giữa hero và khu nội dung. */}
      <TourImageBand label={tour.title} />

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
              {sections.map((heading) => (
                <section
                  key={heading}
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
                  {/* Task 9 điền "All departures", Task 10 điền phần còn lại. */}
                </section>
              ))}
            </div>
          </main>

          <aside className="hidden lg:block">
            <div className="lg:sticky lg:top-28">
              <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                {t.departures.railLabel}
              </p>
              {/* Rail booking thật (giá theo đợt, thanh ghế, nút Reserve, dòng
                  test-mode) vào ở Task 9. */}
            </div>
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
          {/* Gợi ý dựng bằng relatedTours() vào ở Task 10. */}
        </div>
      </section>
    </>
  );
}
