'use client';

import { messages } from '@tourism/i18n';
import { ChevronRightIcon, ClockIcon, StarIcon, UsersIcon } from 'lucide-react';
import { motion } from 'motion/react';
import { useOptionalDepartureSelection } from '@/components/tours/departure-selection';
import { RouteRibbon } from '@/components/tours/route-ribbon';
import type { TourDetailVM } from '@/lib/api/tours';
import { SPRING, SPRING_HEADING } from '@/lib/motion';
import { heroPrice } from '@/lib/tour-detail';
import { discountPercent, formatMoney } from '@/lib/tours';

// Hero riêng cho trang chi tiết — KHÔNG tái dùng ToursHero: cái đó mang eyebrow
// + H1 + subtitle + ô search, còn đây mang rating, chuỗi chặng, chip meta, badge
// và giá. Ba hero (ContentHero, ToursHero, TourHero) chia sẻ TopoPattern + scrim
// + nhịp spring, không chia sẻ component (spec §6.2). Riêng ở trang này lớp vân
// nằm một bậc CAO HƠN hero (`TourBoard`) vì nó phải phủ cả dải khởi hành.

/**
 * Hàng chip cạnh giá giữ TỐI ĐA 2 chip, và một sự thật về GIÁ luôn thắng một
 * nhãn tiếp thị. Card listing đã học luật này bằng cách khó: 3 chip làm chip
 * cuối bị overflow-hidden xén ngang chữ, trông như lỗi render.
 *
 * Nên: có giảm giá thì chip `−N%` chiếm một suất, `badges[]` còn một suất rồi
 * gộp phần dư thành `+N`. Không giảm giá thì badges được cả hai suất.
 */
const MAX_CHIPS = 2;

export function TourHero({ tour }: { tour: TourDetailVM }) {
  const t = messages.tourDetail;
  // Giá ở hero BÁM ĐỢT ĐANG CHỌN (user chốt 19/08 — "khách chỉ hiểu một giá":
  // chọn 19 Sep thì hero lẫn khối chọn ngày cùng nói $129 −13%, chọn 17 Oct
  // thì cùng $119 −20%; giữ giá rẻ nhất cố định trên hero trong khi bên dưới
  // đổi theo đợt là hai con số cho một quyết định). Không có provider (`/book`,
  // `/enquire` qua `TourHeroBoard`) hoặc chưa chọn được đợt nào → rơi về
  // `heroPrice` = "from" đợt rẻ nhất còn chỗ. Nhãn "from" CHỈ hiện ở nhánh
  // rơi về — bám đợt thì đó là giá của đúng ngày đó, không phải "từ".
  const selection = useOptionalDepartureSelection();
  const selected = selection?.departures.find((d) => d.id === selection.selectedId);
  const price = selected
    ? { price: selected.effectivePrice, compareAtPrice: selected.compareAtPrice }
    : heroPrice(tour);
  const isFrom = !selected;
  const discount = discountPercent(price.price, price.compareAtPrice);

  const badgeBudget = discount !== null ? MAX_CHIPS - 1 : MAX_CHIPS;
  const shownBadges = tour.badges.slice(0, badgeBudget);
  const hiddenBadges = tour.badges.length - shownBadges.length;

  return (
    // KHÔNG có `bg-hero` và KHÔNG có `TopoPattern` ở đây — cả hai đã lên
    // `TourBoard` ở page.tsx. Hero là một TẤM của bảng đó, không phải một băng
    // độc lập: nền và lớp vân phải liên tục qua vạch chia mới đọc thành một mặt.
    // Đổi lại, component này chỉ render đúng trên nền do cha cấp.
    <section className="relative w-full overflow-hidden px-4 pt-36 pb-14 md:px-16 md:pb-16 lg:px-24 xl:px-32">
      {/* Quầng sáng góc trên-trái vẫn thuộc RIÊNG hero (nó nhấn vùng H1), nên ở
          lại đây và bị `overflow-hidden` của hero cắt gọn. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-br from-primary/15 via-transparent to-transparent"
      />

      {/* `dark` bọc NỘI DUNG, không đặt lên <section> — section phải đọc `bg-hero`
          theo theme của trang. Đặt `dark` lên section thì `bg-*` bị đọc trong
          scope dark và band trùng màu nền trang ở dark mode (lỗi đã sửa 22bd75e).
          `contents` để wrapper không tạo hộp; biến CSS vẫn kế thừa bình thường. */}
      <div className="dark contents">
        <div className="relative z-10 mx-auto max-w-7xl">
          <motion.nav
            aria-label="Breadcrumb"
            className="flex items-center gap-1.5 text-sm text-muted-foreground"
            initial={{ y: -16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, ...SPRING }}
          >
            <a href="/" className="transition-colors hover:text-foreground">
              Home
            </a>
            <ChevronRightIcon className="size-3.5 shrink-0" aria-hidden="true" />
            <a href="/tours" className="transition-colors hover:text-foreground">
              {t.breadcrumb}
            </a>
            <ChevronRightIcon className="size-3.5 shrink-0" aria-hidden="true" />
            {/* Mắt xích cuối là chuyên mục, KHÔNG phải tên tour: tên tour đã là H1
                ngay dưới, lặp lại là bắt trình đọc màn hình đọc hai lần. Nó cũng
                dẫn tới một trang lọc CÓ THẬT. */}
            <a
              href={`/tours?categories=${tour.category.slug}`}
              aria-current="page"
              className="truncate text-foreground transition-colors hover:text-primary-emphasis"
            >
              {tour.category.name}
            </a>
          </motion.nav>

          {/* Hàng eyebrow + rating: danh tính bên trái, uy tín xã hội bên phải,
              cùng một baseline. */}
          <motion.div
            className="mt-8 flex flex-wrap items-center justify-between gap-x-6 gap-y-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15, ...SPRING }}
          >
            <p className="flex items-center gap-1.5 font-mono text-xs tracking-widest text-muted-foreground uppercase">
              <span className="size-1.5 shrink-0 bg-primary" aria-hidden="true" />
              {tour.category.name}
              {/* difficulty null → bỏ hẳn cả dấu phân cách, không in "· null". */}
              {tour.difficulty ? (
                <>
                  <span aria-hidden="true">·</span>
                  {messages.toursPage.difficultyLabels[tour.difficulty]}
                </>
              ) : null}
            </p>

            {/* ratingAvg null = CHƯA AI đánh giá, khác hẳn 0 điểm. Hiện chip chữ
                thay vì "0.0" hoặc 5 sao rỗng — cả hai đều là nói dối về dữ liệu. */}
            {tour.ratingAvg === null ? (
              <p className="rounded-full border border-muted-foreground/30 px-3 py-1 text-xs text-muted-foreground">
                {t.notRated}
              </p>
            ) : (
              <p className="flex items-center gap-2 text-sm">
                <StarIcon className="size-4 shrink-0 fill-rating text-rating" aria-hidden="true" />
                <span className="font-medium text-foreground">{tour.ratingAvg.toFixed(1)}</span>
                <span className="text-muted-foreground">{t.reviewCount(tour.ratingCount)}</span>
              </p>
            )}
          </motion.div>

          <motion.h1
            className="mt-3 max-w-3xl font-heading text-4xl leading-tight font-medium text-balance text-foreground md:text-5xl"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ ...SPRING_HEADING, delay: 0.2 }}
          >
            {tour.title}
          </motion.h1>

          {/* summary null → ẩn CẢ dòng, không giữ chỗ. Khác card listing (ở đó
              phải giữ 2 dòng để các card cạnh nhau không lệch chiều cao); hero
              chỉ có một, không có gì để so hàng. */}
          {tour.summary ? (
            <motion.p
              className="mt-4 max-w-2xl text-pretty text-muted-foreground"
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3, ...SPRING }}
            >
              {tour.summary}
            </motion.p>
          ) : null}

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35, ...SPRING }}
          >
            <RouteRibbon destinations={tour.destinations} className="mt-8" />
          </motion.div>

          {/* Hàng chân hero: dữ liệu chuyến đi bên trái, thương mại bên phải.
              `items-end` để giá cỡ lớn và chip meta cỡ nhỏ chung một đường đáy. */}
          <motion.div
            className="mt-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-5 border-t border-muted-foreground/20 pt-6"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4, ...SPRING }}
          >
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ClockIcon className="size-4 shrink-0" aria-hidden="true" />
                {t.durationValue(tour.durationDays)}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <UsersIcon className="size-4 shrink-0" aria-hidden="true" />
                {t.groupSize(tour.maxGroupSize)}
              </span>
            </div>

            <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
              <p className="flex items-baseline gap-2">
                <span className="text-xs text-muted-foreground">
                  {isFrom ? t.fromPrice : t.booking.perPerson}
                </span>
                <span className="font-heading text-3xl font-semibold text-foreground tabular-nums">
                  {formatMoney(price.price, tour.currency)}
                </span>
                {price.compareAtPrice ? (
                  <>
                    {/* Con số hiện ra bị aria-hidden, và trình đọc màn hình nghe
                        câu đầy đủ "was $236" — nghe trần hai giá cạnh nhau thì
                        không biết giá nào đang có hiệu lực. */}
                    <span className="sr-only">
                      {t.wasPrice(formatMoney(price.compareAtPrice, tour.currency))}
                    </span>
                    <span
                      aria-hidden="true"
                      className="text-sm text-price-compare tabular-nums line-through"
                    >
                      {formatMoney(price.compareAtPrice, tour.currency)}
                    </span>
                  </>
                ) : null}
              </p>

              <div className="flex flex-wrap items-center gap-1.5">
                {discount !== null ? (
                  <span className="rounded-full bg-destructive px-2.5 py-1 text-xs font-medium text-white">
                    −{discount}%
                  </span>
                ) : null}
                {shownBadges.map((badge) => (
                  <span
                    key={badge}
                    className={
                      // LIMITED_OFFER là badge duy nhất mang tính khẩn — cho nó
                      // token cảnh báo, phần còn lại là viền trầm. Nếu badge nào
                      // cũng nổi thì không badge nào nổi.
                      badge === 'LIMITED_OFFER'
                        ? 'rounded-full bg-warning px-2.5 py-1 text-xs font-medium text-warning-foreground'
                        : 'rounded-full border border-muted-foreground/30 px-2.5 py-1 text-xs text-muted-foreground'
                    }
                  >
                    {t.badges[badge]}
                  </span>
                ))}
                {hiddenBadges > 0 ? (
                  <span className="text-xs text-muted-foreground">
                    {t.moreBadges(hiddenBadges)}
                  </span>
                ) : null}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// `TourImageBand` (băng ảnh 21:9 full-bleed) đã bị bỏ: nó chiếm 617px ở màn 1440
// mà chỉ nói được "sẽ có ảnh ở đây". Thay bằng `TourGallery` — khảm nhiều ảnh nằm
// trong max-w-7xl. Token `--aspect-band` giữ lại: bộ aspect là bảng có sẵn
// (`--aspect-hero`, `--aspect-thumb` cũng đang chưa dùng), không phải tập chỉ-những-
// gì-đang-dùng.
