import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { TopoPattern } from '@/components/topo-pattern';
import { DepartureDialog } from '@/components/tours/departure-dialog';
import {
  BookingRailConnected,
  DepartureSelectionProvider,
} from '@/components/tours/departure-selection';
import { OverviewPanel } from '@/components/tours/panels/overview-panel';
import { RelatedTours } from '@/components/tours/related-tours';
import { TourHero } from '@/components/tours/tour-hero';
import { TourMediaPanel } from '@/components/tours/tour-media-panel';
import { TourTabs } from '@/components/tours/tour-tabs';
import { fetchTourDetail, fetchTours } from '@/lib/api/tours';
import { absoluteUrl } from '@/lib/site';
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
 * ⚠️ PHẦN THÂN ĐANG TRỐNG — CỐ Ý, đang dựng lại.
 *
 * Toàn bộ khối gallery + panel đặt chỗ + 5 tab đã xoá ngày 13/08 để dựng LẠI TỪ
 * ĐẦU bám thẳng markup của wireframe đã duyệt
 * (`docs/design/mockups/tour-detail.src.html`), thay vì vá tiếp lên bản cũ vốn
 * lệch bản duyệt ở quá nhiều chỗ. Hero và "You might also like" giữ nguyên vì
 * hai khối đó đã đo khớp.
 *
 * Trang KHÔNG có mục lục `OnThisPage` — dải năm tab thay vai nó (giữ cả hai là
 * dựng hai bộ điều hướng cho cùng một tập nội dung). `OnThisPage` vẫn sống ở
 * `/blog`, không xoá component. Anchor cũ (`#itinerary`, `#departures`,
 * `#reviews`, `#good-to-know`) tạm chưa trỏ tới đâu cho tới khi dải tab dựng
 * lại xong — xem ADR-0022.
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
  const [tours] = await Promise.all([fetchTours()]);

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

        {/* KHÔNG có dải khởi hành ở đây. Bản wireframe user duyệt không có nó, và
            lý do đọc ra ngay trên màn hình: panel đặt chỗ ngay dưới đã có đúng
            bốn ô ngày đó — giữ cả hai là in cùng một thông tin hai lần cách nhau
            một màn cuộn. Spec §1 của mình ghi "giữ nguyên dải khởi hành" là ghi
            sai so với bản đã duyệt; bản duyệt thắng. `DepartureStrip` vẫn còn
            trong repo, chỉ là trang này không dùng. */}
      </div>

      {/* Khung 1152, đệm ngang 48 → nội dung ĐÚNG 1056px.
          ĐO TỪ WIREFRAME ĐÃ DUYỆT, không phải từ bản ReUI gốc: file wireframe có
          hai `<div class="shell">` lồng nhau (mỗi cái `padding:40px 24px`) nên
          đệm cộng dồn 24+24, và bản user duyệt render ở 1056 chứ không phải 1104
          như spec §2.1 ghi. Bản đã duyệt thắng.
          1056 chia tiếp ra 573 | 40 | 443 — cột phải vẫn GHIM 443px (không dùng
          `1.4fr/1fr`, tỉ lệ đó cho số lẻ và làm mọi đường 1px lệch nửa pixel),
          ảnh vuông ra 573−64−16 = 493 chẵn, và dải 5 tab ra (1056−4×24)/5 = 192
          chẵn. Mọi con số đều nguyên. */}
      {/* ── CHỖ DỰNG LẠI PHẦN THÂN ──
          Khung 1152 + đệm ngang 48 → nội dung ĐÚNG 1056px, và `--radius:1rem`
          là base bo góc của wireframe (site dùng 0.375rem). Hai con số này đã đo
          khớp bản duyệt nên giữ lại làm khung cho phần dựng mới. */}
      <div className="mx-auto w-full max-w-6xl px-12 py-14 [--radius:1rem]">
        <TourMediaPanel tour={tour} />

        {/* MỘT instance duy nhất cho cả trang: ô "All N dates" ở panel và nút
            "See all dates" ở tab Departures đều mở modal này qua
            `openAllDates()` trong context. */}
        <DepartureDialog
          tourTitle={tour.title}
          currency={tour.currency}
          durationDays={tour.durationDays}
          maxGroupSize={tour.maxGroupSize}
        />

        {/* Năm panel đang dựng lần lượt (R4–R8). Chỗ giữ tạm nói rõ nó là chỗ
            giữ tạm — KHÔNG để trống, vì `TourTabs` phải render đủ 5 panel vào
            HTML tĩnh ngay từ bây giờ (ADR-0022) và một panel rỗng trông y hệt
            một panel hỏng. */}
        <TourTabs
          panels={{
            overview: <OverviewPanel tour={tour} />,
            itinerary: <PanelPlaceholder name="Itinerary" />,
            departures: <PanelPlaceholder name="Departures" />,
            reviews: <PanelPlaceholder name="Reviews" />,
            goodToKnow: <PanelPlaceholder name="Good to know" />,
          }}
        />
      </div>

      <section
        aria-labelledby="related-heading"
        // KHÔNG đè `--radius` ở khu này: `TourCard` dùng chung với trang
        // listing, đè base bo góc ở đây là cùng một card hiện hai kiểu ở hai
        // trang. Base 1rem của wireframe chỉ áp cho phần thân trang tour.
        className="mx-auto w-full max-w-6xl px-12 pb-24"
      >
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

/** Chỗ giữ tạm cho một panel chưa dựng. Xoá dần khi R4–R8 xong. */
function PanelPlaceholder({ name }: { name: string }) {
  return (
    <p className="rounded-md border border-dashed border-border px-4 py-10 text-center text-muted-foreground">
      Panel “{name}” đang được dựng lại theo wireframe.
    </p>
  );
}
