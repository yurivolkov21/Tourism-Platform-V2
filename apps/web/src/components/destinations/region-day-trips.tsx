import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import { MoveRightIcon, StarIcon } from 'lucide-react';
import Link from 'next/link';
import { SectionEyebrow } from '@/components/home/section-eyebrow';
import { RevealHeading, RevealLede } from '@/components/motion/reveal-header';
import { RevealItem } from '@/components/motion/reveal-item';
import type { TourCardVM } from '@/lib/api/tours';
import { STAGGER } from '@/lib/motion';
import { formatMoney } from '@/lib/tours';
import type { MockItineraryDay } from '@/mocks/types';

/** Dưới ngưỡng này thì khu KHÔNG dựng. Một "dải" một phần tử không phải dải — nó
    là một card lạc lõng, và tiêu đề "1 of these trips fit in a single day" thì
    vừa sai ngữ pháp vừa không nói được điều gì về vùng. */
const MIN_TRIPS = 2;

/** Tour mà khu này đọc. `itinerary` OPTIONAL dù `TourDetailVM` khai nó bắt buộc:
    khu nhận được cả `TourCardVM` (không có hành trình — field đó chỉ ở payload
    chi tiết) lẫn tour đã có hành trình, và tour chưa nhập hành trình là nhánh
    có thật khi gắn API. */
type DayTripTour = TourCardVM & { itinerary?: readonly MockItineraryDay[] };

/**
 * HỢP ĐỒNG SỐ DÒNG (Task 5o) — lý do tồn tại là một lỗi user nhìn ra trên trang
 * thật: *"chưa được cố định tiêu đề bao nhiêu dòng, nội dung bao nhiêu dòng, dẫn tới
 * có sự lệch pha trong ảnh. Chỗ thì bị thục lên thục xuống"*.
 *
 * Đo bằng trình duyệt ở 1440 (bốn thẻ một hàng) và 768 (hai thẻ một hàng): tiêu đề
 * chiếm **2 dòng ở thẻ 1+4** và **1 dòng ở thẻ 2+3**, và 28px `line-height` đó đẩy
 * hàng mô tả cùng hàng đánh giá tụt **đúng 28px** so với hai thẻ bên cạnh. Hàng giá
 * KHÔNG lệch — nó có `mt-auto` neo xuống đáy; hai hàng giữa thì không có gì neo.
 *
 * `line-clamp` MỘT MÌNH không chữa được: nó cắt phần thừa nhưng **không giữ chỗ**,
 * nên tiêu đề 1 dòng và 2 dòng vẫn cho hai chiều cao khác nhau. Phải cộng
 * `min-h-[2lh]` — `lh` là "một line-height của chính phần tử", nên đổi cỡ chữ không
 * phải đi chỉnh lại con số. Cùng hợp đồng `tours/tour-list-card.tsx` (`CLAMP`) và
 * `tours/tour-card.tsx` đang dùng; đây là bản thứ ba của cùng một luật, không phải
 * một luật mới.
 *
 * Vì sao ở ĐÂY clamp là đúng (khác `region-days.tsx`/`region-intro.tsx`, hai chỗ chỉ
 * giữ chỗ): hộp này hẹp — 233px chữ ở 1440, 192px ở cột hẹp nhất mà `auto-fit` cho
 * phép — và tiêu đề tour tới từ API nên độ dài KHÔNG có trần. Đã đo trên mock hiện
 * tại ở 390/768/1440: không tiêu đề nào tràn 2 dòng, tức hôm nay clamp cắt 0 ký tự.
 */
const CLAMP = 'line-clamp-2 min-h-[2lh]';

/**
 * Khu các chuyến gói gọn trong MỘT ngày — CHỈ miền Trung dựng, và nó là khu CUỐI
 * của trang đó.
 *
 * Vì sao chỉ miền Trung: đo 29/07, chuyến riêng của Trung là 1, 1, 1, 1, 6 —
 * **bốn trên năm** nằm gọn trong một ngày. Bắc chỉ có một chuyến như vậy (dưới
 * ngưỡng, khu tự ẩn) và Nam có hai. Đây là sự thật riêng của vùng, không phải một
 * khuôn đem áp cho đủ ba trang.
 *
 * Mỗi thẻ mang MỘT CÂU thật — tiêu đề ngày 1 của chính hành trình tour ("Citadel,
 * lunch, river"). Bản trước chỉ có chuyên mục · tên · giá, tức ba mẩu nhãn cạnh
 * nhau, và một lưới bốn ô như thế đọc ra bảng số liệu. Câu hành trình là thứ cho
 * người đọc biết ngày đó thật sự trôi qua như thế nào — ngôn ngữ khách du lịch,
 * đúng luật rút ra khi user bác khu phổ.
 *
 * ⚠️ **Nền TRANG, không phải băng phớt** (đổi ở Task 5k, trước đó khu này đứng trên
 * băng). Đây là khu cuối trang Trung, và `site-footer.tsx` mang `mt-32` sơn màu
 * `--background`; khu cuối có nền riêng thì 128px đó hiện ra thành một vạch sáng
 * kẹp giữa khu này và footer. Cơ chế `data-flush-footer` từng vá chuyện đó đã xoá
 * đúng vì cả ba miền giờ kết bằng khu nền-trang. `region-day-trips.spec.tsx` canh
 * rằng `<section>` không mang `style` — đó là chốt duy nhất bắt được, vì jsdom
 * không dựng layout và Vitest không quét `src/app/**`.
 *
 * Khu này LỌC LẤY `durationDays === 1` ngay tại đây thay vì nhận mảng đã lọc sẵn:
 * tiêu đề tự khai một con số ("4 of these trips…") nên phép đếm và phép lọc phải ở
 * CÙNG một chỗ. Tách ra hai tầng là mở đường cho tiêu đề nói một số mà lưới bên
 * dưới vẽ một số khác — đúng họ lỗi mà `regionGlance()` đi tránh.
 *
 * Truyền vào nên là **chuyến RIÊNG của vùng** (`ownToursInRegion`); trên mock hiện
 * tại hai định nghĩa cho cùng kết quả vì chuyến xuyên vùng dài 12 ngày nên đằng nào
 * cũng rụng ở bộ lọc một-ngày.
 */
export function RegionDayTrips({ tours }: { tours: readonly DayTripTour[] }) {
  const t = messages.regionPage.dayTrips;
  const dayTrips = tours.filter((tour) => tour.durationDays === 1);

  if (dayTrips.length < MIN_TRIPS) return null;

  // Quyết định "có hàng mô tả hay không" là quyết định của CẢ NHÓM, không của từng
  // thẻ (đổi ở Task 5o). Bản trước render có điều kiện trên từng thẻ, và đó chính là
  // một nguồn lệch pha thứ hai: thẻ thiếu hành trình thì hàng đánh giá của nó nhảy
  // lên 32px trong khi ba thẻ bên cạnh không nhảy. Nên: còn MỘT chuyến có câu hành
  // trình thì cả nhóm giữ chỗ cho hàng đó; KHÔNG chuyến nào có thì cả nhóm bỏ hẳn —
  // không thẻ nào phải đeo hai dòng trắng vô nghĩa.
  const hasNotes = dayTrips.some((tour) => tour.itinerary?.[0]?.title);

  return (
    <section className="w-full px-4 py-16 md:px-16 md:py-20 lg:px-24 xl:px-32">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          {/* `SectionEyebrow` là `text-foreground`, KHÔNG tô `--primary` — trên nền
              trang primary đo 3.03:1 ở dark, dưới ngưỡng 4.5 chữ nhỏ. */}
          <SectionEyebrow>{t.eyebrow}</SectionEyebrow>
          {/* Cascade header (Task 5m) — xem `motion/reveal-header.tsx`. Nhịp nằm
              trên phần tử CON, không trên `<section>`: spec canh rằng section không
              mang `style` (nó là khu cuối trang Trung, nền riêng thì `mt-32` của
              footer hiện ra thành vạch sáng). */}
          <RevealHeading className="mt-4 font-heading text-3xl leading-tight font-medium text-balance text-foreground md:text-[40px]/12">
            {t.heading(dayTrips.length)}
          </RevealHeading>
          <RevealLede className="mt-2 text-lg text-pretty text-muted-foreground">
            {t.subtitle}
          </RevealLede>
        </div>

        {/* `auto-fit` chứ không `lg:grid-cols-4` cố định: số chuyến một ngày là dữ
            liệu, không phải hằng. Bốn cột cứng để lại hai ô trống khi vùng chỉ có
            hai chuyến, và ép chữ xuống quá hẹp khi có sáu. */}
        <ul className="mt-12 grid grid-cols-[repeat(auto-fit,minmax(15rem,1fr))] gap-4 sm:mt-14 sm:gap-5">
          {dayTrips.map((tour, i) => {
            // Ngày 1 của hành trình. `?.` vì `noUncheckedIndexedAccess` và vì
            // `itinerary` có thể vắng hẳn — thiếu ở MỘT thẻ thì hộp vẫn giữ chỗ
            // (`hasNotes`), thiếu ở CẢ nhóm thì bỏ hẳn hàng.
            const openingDay = tour.itinerary?.[0]?.title;
            return (
              <li key={tour.slug} data-day-trip={tour.slug}>
                {/* ── Chữ ký miền TRUNG: trượt ngang từ TRÁI, nối tiếp (Task 5n) ──
                    Cùng trục với khu di sản mở đầu trang, nên hai đầu trang Trung khép
                    lại thành một chữ ký. `h-full` phải có trên chính `RevealItem`:
                    `<Link>` bên trong dùng `h-full` để hàng giá luôn tụt xuống đáy ô
                    (`mt-auto`), và chuỗi đó chỉ nối được nếu mọi mắt giữa `li` (ô lưới
                    bị kéo cao bằng hàng) và `Link` đều cao 100%. */}
                <RevealItem enter="slide" delay={i * STAGGER.grid} className="h-full">
                  {/* Thẻ VIỀN, không tô nền: khu này đứng trên nền trang, và đo được
                    ở đợt trước là không token bề mặt nào của bảng màu tách nổi 3:1
                    khỏi nền — một thẻ tô nền chỉ đọc ra "hơi khác". Viền cộng
                    khoảng cách thì đọc được ở cả hai theme, và thứ ĐỊNH DANH thẻ là
                    chữ trong nó (13.30 light / 11.81 dark). */}
                  <Link
                    href={`/tours/${tour.slug}`}
                    className="group flex h-full flex-col rounded-2xl border border-border p-6 transition-colors hover:border-foreground/30"
                  >
                    {/* Chuyên mục · ĐỘ KHÓ trên cùng một dòng. Độ khó thêm 30/07 và
                      nó là thông tin MỚI, không phải nhắc lại: cả khu đã nói "một
                      ngày" nên số ngày thì lặp, còn bậc độ khó thì chưa ở đâu trong
                      khu này nói. `difficulty` nullable — thiếu thì bỏ luôn cả dấu
                      phân cách, không để một dấu `·` treo lơ lửng. */}
                    <span className="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">
                      {tour.category.name}
                      {tour.difficulty
                        ? ` · ${messages.toursPage.difficultyLabels[tour.difficulty]}`
                        : null}
                    </span>
                    {/* Hợp đồng 2 dòng — xem `CLAMP`. `data-trip-title` là móc để
                      spec đọc đúng hộp mang hợp đồng đó. */}
                    <span
                      data-trip-title
                      className={cn(
                        CLAMP,
                        'mt-3 font-heading text-xl font-medium text-pretty text-foreground group-hover:text-primary-emphasis',
                      )}
                    >
                      {tour.title}
                    </span>
                    {/* Hộp này GIỮ CHỖ kể cả khi `openingDay` vắng (xem `hasNotes`) —
                      nó rỗng chứ không bị bỏ, để hàng đánh giá của thẻ thiếu hành
                      trình không nhảy lên trước ba thẻ bên cạnh. Rỗng thì trình đọc
                      màn hình không đọc gì, nên không sinh nhiễu. */}
                    {hasNotes ? (
                      <span
                        data-trip-note
                        className={cn(CLAMP, 'mt-2 text-sm text-pretty text-muted-foreground')}
                      >
                        {openingDay}
                      </span>
                    ) : null}

                    {/* Đánh giá — tín hiệu mạnh nhất nói "đây là một chuyến bán được,
                      có người đã đi". `ratingAvg === null` là CHƯA AI đánh giá, khác
                      hẳn 0 điểm: in nhãn chữ thay vì "0.0" hay năm sao rỗng, cùng
                      cách `TourCard` xử. Sao dùng `fill-rating` như mọi chỗ khác. */}
                    <span className="mt-3 flex items-center gap-1.5 text-sm">
                      {tour.ratingAvg === null ? (
                        <span className="text-xs text-muted-foreground">
                          {messages.toursPage.notRated}
                        </span>
                      ) : (
                        <>
                          <StarIcon
                            aria-hidden="true"
                            className="size-3.5 fill-rating text-rating"
                          />
                          <span className="font-medium text-foreground">
                            {tour.ratingAvg.toFixed(1)}
                          </span>
                          <span className="text-muted-foreground">
                            ({tour.ratingCount.toLocaleString('en-US')})
                          </span>
                        </>
                      )}
                    </span>
                    {/* `mt-auto` để hàng chân luôn tụt xuống đáy ô dù tiêu đề và câu
                      hành trình dài ngắn khác nhau — hàng giá đọc thành một dòng
                      ngang, không so le.
                      KHÔNG in "1 day" ở đây: cả khu đã là "chuyến một ngày", lặp
                      lại trên từng ô là in cùng một sự thật bốn lần.
                      `per person` thêm 30/07 — nó nói giá này là giá MỘT KHÁCH, tức
                      đây là thứ đặt được, không phải một con số trang trí. Cùng chuỗi
                      `TourCard` dùng, không khai bản thứ hai. */}
                    <span className="mt-auto flex items-end justify-between gap-3 border-t border-border pt-4">
                      <span className="flex items-baseline gap-1.5">
                        <span className="font-heading text-lg font-semibold text-foreground tabular-nums">
                          {formatMoney(tour.basePrice, tour.currency)}
                        </span>
                        <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                          {messages.toursPage.perPerson}
                        </span>
                      </span>
                      {/* Nhãn CHỮ thay mũi tên trơ — user không nhận ra thẻ dẫn đi đâu
                        khi chỉ có mỗi mũi tên. `aria-hidden` cho icon vì chữ đã nói. */}
                      <span className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors group-hover:text-primary-emphasis">
                        {t.viewTrip}
                        <MoveRightIcon
                          aria-hidden="true"
                          className="size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none"
                        />
                      </span>
                    </span>
                  </Link>
                </RevealItem>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
