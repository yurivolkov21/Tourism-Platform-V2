import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { ClockIcon, HeartIcon, MapPinIcon, StarIcon, UsersIcon } from 'lucide-react';
import { ImagePlaceholder } from '@/components/image-placeholder';
import type { TourCardVM } from '@/lib/api/tours';
import { discountPercent, formatMoney, routeChain } from '@/lib/tours';

/**
 * HỢP ĐỒNG SỐ DÒNG — lý do tồn tại: card cao thấp so le làm hỏng nhịp của cả
 * danh sách, và `line-clamp` MỘT MÌNH không đủ (nó cắt phần thừa nhưng không
 * giữ chỗ, nên tiêu đề 1 dòng và tiêu đề 2 dòng vẫn cho hai chiều cao khác
 * nhau). Mỗi ô vừa clamp vừa `min-h-[Nlh]` để luôn chiếm đúng N dòng.
 *
 *   Dòng meta (địa danh · số ngày · nhóm)  1 dòng, cắt bằng truncate
 *   Tiêu đề                                2 dòng, giữ chỗ 2 dòng
 *   Tóm tắt                                2 dòng, giữ chỗ 2 dòng
 *   Chuỗi chặng                            1 dòng, cắt bằng truncate
 *   Hàng chip (chuyên mục/độ khó)          1 dòng, tối đa 2 chip (MAX_CHIPS)
 *   Rail giá                               1 dòng mỗi phần tử, bề rộng cố định
 *
 * `lh` là đơn vị "một line-height của chính phần tử" — dùng nó thay số rem
 * cứng để đổi cỡ chữ không phải đi chỉnh lại chiều cao.
 */
const CLAMP = {
  title: 'line-clamp-2 min-h-[2lh]',
  summary: 'line-clamp-2 min-h-[2lh]',
  oneLine: 'truncate',
} as const;

/**
 * Tối đa 2 chip. Ba chip từng làm chip cuối bị `overflow-hidden` xén NGANG CHỮ
 * trên tour có tên chuyên mục dài ("Culture & heritage" + "Moderate" +
 * "Featured") — trông như lỗi render. CSS không có cách "chỉ hiện item nào vừa
 * đủ", nên giới hạn cứng ở nguồn.
 *
 * `Featured` vì thế chuyển lên huy hiệu góc ảnh (chỗ giá giảm đang dùng, hai
 * thứ không bao giờ cùng lúc quan trọng bằng nhau — giảm giá thắng).
 */
const MAX_CHIPS = 2;

export function TourListCard({ tour }: { tour: TourCardVM }) {
  const t = messages.toursPage;
  const href = `/tours/${tour.slug}`;
  const chain = routeChain(tour.destinations);
  const primary = chain[0];
  const discount = discountPercent(tour.basePrice, tour.compareAtPrice);

  const chips = [
    tour.category.name,
    tour.difficulty ? messages.toursPage.difficultyLabels[tour.difficulty] : null,
  ]
    .filter((c): c is string => c !== null)
    .slice(0, MAX_CHIPS);

  return (
    <article className="group relative overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-(--shadow-dropdown) sm:flex">
      <div className="relative shrink-0 sm:w-60 lg:w-72">
        {/* Trợ năng: nhãn ảnh là tên destination chính, KHÔNG phải tour.title —
            title đã nằm ngay ở <h3> bên cạnh, lặp lại là trình đọc màn hình
            đọc hai lần. */}
        <ImagePlaceholder
          label={primary?.name}
          className="aspect-16/10 w-full sm:h-full sm:aspect-auto"
        />
        {discount !== null ? (
          <span className="absolute top-3 left-3 rounded-full bg-destructive px-2.5 py-1 text-xs font-medium text-white">
            −{discount}%
          </span>
        ) : tour.isFeatured ? (
          <span className="absolute top-3 left-3 rounded-full bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground">
            {t.featuredBadge}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-5 p-5 sm:flex-row sm:items-stretch sm:gap-6 sm:p-6">
        <div className="min-w-0 flex-1">
          {/* Meta — một dòng, không bao giờ xuống hàng */}
          <div
            className={`flex items-center gap-x-4 font-mono text-xs tracking-wide text-muted-foreground uppercase ${CLAMP.oneLine}`}
          >
            <span className="inline-flex shrink-0 items-center gap-1.5">
              <MapPinIcon className="size-3.5" aria-hidden="true" />
              {primary?.name}
            </span>
            <span className="inline-flex shrink-0 items-center gap-1.5">
              <ClockIcon className="size-3.5" aria-hidden="true" />
              {t.durationValue(tour.durationDays)}
            </span>
            <span className="inline-flex shrink-0 items-center gap-1.5">
              <UsersIcon className="size-3.5" aria-hidden="true" />
              {t.maxGroup(tour.maxGroupSize)}
            </span>
          </div>

          <h3 className={`mt-2 font-heading text-xl leading-tight font-medium ${CLAMP.title}`}>
            {/* Lớp phủ vô hình biến cả card thành vùng bấm; nút wishlist phía
                dưới phải relative z-10 để nổi lên trên. */}
            <a href={href} className="transition-colors after:absolute after:inset-0">
              {tour.title}
            </a>
          </h3>

          {/* Tóm tắt nullable — vẫn GIỮ CHỖ 2 dòng khi rỗng để card cạnh nó
              không cao hơn hẳn. */}
          <p className={`mt-2 text-sm text-pretty text-muted-foreground ${CLAMP.summary}`}>
            {tour.summary ?? ''}
          </p>

          {/* Chuỗi chặng — thứ duy nhất phân biệt card tour với card khách sạn */}
          <p className={`mt-2 font-mono text-xs text-muted-foreground ${CLAMP.oneLine}`}>
            {chain.map((dest, i) => (
              <span key={dest.slug}>
                {i > 0 ? <span aria-hidden="true"> → </span> : null}
                <span className={dest.isPrimary ? 'font-medium text-foreground' : undefined}>
                  {dest.name}
                </span>
              </span>
            ))}
          </p>

          <div className="mt-3 flex items-center gap-x-3 gap-y-2 overflow-hidden">
            {/* ratingAvg null = CHƯA AI đánh giá. Bỏ hẳn dòng sao thay vì hiện
                "0.0" hay 5 sao rỗng. */}
            <span className="inline-flex shrink-0 items-center gap-1.5 text-sm">
              {tour.ratingAvg === null ? (
                <span className="text-xs text-muted-foreground">{t.notRated}</span>
              ) : (
                <>
                  <StarIcon className="size-4 fill-rating text-rating" aria-hidden="true" />
                  <span className="font-medium">{tour.ratingAvg.toFixed(1)}</span>
                  <span className="text-muted-foreground">
                    ({tour.ratingCount.toLocaleString('en-US')})
                  </span>
                </>
              )}
            </span>
            <span className="flex gap-1.5 overflow-hidden">
              {chips.map((chip) => (
                <span
                  key={chip}
                  className="shrink-0 rounded-full border px-2.5 py-0.5 text-xs text-muted-foreground"
                >
                  {chip}
                </span>
              ))}
            </span>
          </div>
        </div>

        {/* Rail giá — bề rộng cố định để mọi card thẳng cột giá */}
        <div className="flex shrink-0 items-end justify-between gap-3 border-t pt-4 sm:w-40 sm:flex-col sm:items-end sm:justify-center sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6 sm:text-right">
          <div>
            {tour.compareAtPrice ? (
              <span className="mr-1.5 text-sm text-price-compare tabular-nums line-through">
                {formatMoney(tour.compareAtPrice, tour.currency)}
              </span>
            ) : null}
            <span className="font-heading text-2xl font-semibold tabular-nums">
              {formatMoney(tour.basePrice, tour.currency)}
            </span>
            <span className="block text-xs text-muted-foreground">{t.perPerson}</span>
          </div>
          <div className="relative z-10 flex items-center gap-1.5">
            <Button variant="ghost" size="icon-sm" aria-label={`Save ${tour.title} to wishlist`}>
              <HeartIcon />
            </Button>
            <ButtonLink size="sm" href={href}>
              {t.viewTour}
            </ButtonLink>
          </div>
        </div>
      </div>
    </article>
  );
}
