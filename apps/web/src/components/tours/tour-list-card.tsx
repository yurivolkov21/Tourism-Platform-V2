import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { ClockIcon, MapPinIcon, StarIcon, UsersIcon } from 'lucide-react';
import { SlotImage } from '@/components/slot-image';
import { WishlistHeart } from '@/components/tours/wishlist-heart';
import type { TourCardVM } from '@/lib/api/tours';
import { discountPercent, formatMoney, routeChain } from '@/lib/tours';

/**
 * Thẻ tour của lưới /tours — dựng theo wireframe user chốt 17/08
 * (`docs/design/mockups/tours-card-grid.src.html`): khung của ReUI
 * `product-grid-1`, ảnh khuyết góc của ReUI `product-card-5`, token dự án.
 * Wireframe là HỢP ĐỒNG, không phải phác thảo: số đo dưới đây trích bằng máy
 * từ chính nó, đừng chỉnh bằng mắt.
 *
 *   thẻ      padding 12 · viền 1 · bo 1rem
 *   ảnh      3:2, bo 12, mask khuyết góc trên-phải
 *   thân     padding 14 4 4 · gap 8 · năm băng
 *
 * Đây là bản THAY THẾ thẻ hàng-ngang cũ (ảnh trái · thân giữa · rail giá phải,
 * một cột dọc). Lưới hai cột nên mỗi thẻ chỉ còn ~580px, không đủ chỗ cho rail
 * giá riêng, nên giá xuống chân thẻ nằm cùng hàng với CTA.
 */

/**
 * HỢP ĐỒNG SỐ DÒNG — user chốt 17/08: "tiêu đề 1 dòng, mô tả chiếm 2 dòng thì
 * nhớ cố định, để tránh trường hợp tiêu đề dài 2 dòng thì card tour lại giãn
 * ra". Bản cũ cho tiêu đề 2 dòng; lưới hai cột thì thẻ hẹp hơn nên tiêu đề dài
 * tràn dòng thường xuyên hơn hẳn, và một thẻ cao hơn là cả HÀNG cao theo.
 *
 * Vì sao `h-*` chứ không `min-h-*`: `min-h` chỉ chặn chiều HỤT. Bài toán ở đây
 * là chặn cả chiều PHÌNH — mà chặn phình thì phải có `h` cố định cộng cắt chữ.
 * `lh` = "một line-height của chính phần tử", nên đổi cỡ chữ không phải đi
 * chỉnh lại con số chiều cao.
 *
 *   Băng dữ kiện (địa danh · số ngày · nhóm)  1 dòng, cắt bằng truncate
 *   Tiêu đề                                   ĐÚNG 1 dòng + ellipsis
 *   Tóm tắt                                   ĐÚNG 2 dòng
 *   Băng rating + chip                        1 dòng, tối đa 2 chip
 *   Hàng giá + CTA                            1 dòng
 */
const CLAMP = {
  /** `truncate` = nowrap + overflow-hidden + ellipsis. */
  title: 'h-[1lh] truncate',
  summary: 'line-clamp-2 h-[2lh]',
  oneLine: 'truncate',
} as const;

/**
 * Tối đa 2 chip — giữ nguyên luật của bản cũ. Ba chip từng làm chip cuối bị
 * `overflow-hidden` xén NGANG CHỮ trên tour có tên chuyên mục dài, trông như
 * lỗi render. Thẻ lưới còn hẹp hơn thẻ hàng-ngang nên luật này càng cần.
 */
const MAX_CHIPS = 2;

/**
 * Góc khuyết của `product-card-5`. Path chép NGUYÊN VĂN từ mẫu gốc (toạ độ
 * 0..1), chỉ đổi cách áp: wireframe dùng `<mask id>` trong SVG, ở đây là
 * `mask-image` với data URI vì lưới render N thẻ — một `id` trùng N lần là
 * HTML không hợp lệ. `viewBox="0 0 1 1"` + `preserveAspectRatio="none"` +
 * `mask-size: 100% 100%` cho ra ĐÚNG phép co giãn của
 * `maskContentUnits="objectBoundingBox"`, nên hình học không đổi.
 *
 * `fill='white'` không phải màu thiết kế mà là kênh ALPHA của mask (trắng =
 * giữ lại, trong suốt = cắt đi) — nằm ngoài luật tokens-only.
 */
const NOTCH_PATH =
  'M 0.04 0 H 0.74 Q 0.79 0 0.825 0.035 L 0.965 0.175 Q 1 0.21 1 0.26 V 0.96 Q 1 1 0.96 1 H 0.26 Q 0.21 1 0.175 0.965 L 0.035 0.825 Q 0 0.79 0 0.74 V 0.04 Q 0 0 0.04 0 Z';
const NOTCH_MASK = `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1' preserveAspectRatio='none'><path d='${NOTCH_PATH}' fill='white'/></svg>")`;
const notchStyle = {
  maskImage: NOTCH_MASK,
  WebkitMaskImage: NOTCH_MASK,
  maskSize: '100% 100%',
  WebkitMaskSize: '100% 100%',
} as const;

/**
 * Ảnh thẻ chiếm ~1/2 bề rộng lưới trên desktop, cả bề rộng khi lưới sập 1 cột.
 * Khai đúng để Next đừng tải bản 1920px cho một khung 554px.
 */
const COVER_SIZES = '(min-width: 1024px) 580px, (min-width: 640px) 50vw, 100vw';

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
    <article className="group relative flex flex-col rounded-2xl border bg-card p-3 shadow-(--shadow-card) transition-shadow hover:shadow-(--shadow-dropdown)">
      {/* BADGE VÀ NÚT TIM PHẢI NẰM NGOÀI phần tử mang mask. Mask cắt MỌI thứ
          bên trong nó, kể cả con nằm đè — mà vết khuyết của product-card-5 nằm
          đúng góc trên-phải, chính chỗ product-grid-1 đặt nút wishlist. Đo trên
          khung 554×369: vết cắt bắt đầu ở x=410 mép trên và y=96 mép phải, nên
          nút tim (x 512..542) nằm TRỌN trong vùng bị cắt và biến mất sạch.
          Lời giải: bọc thêm một lớp, chỉ khung ảnh mang mask, badge và tim là
          ANH EM của nó — nút tim vì thế ngồi gọn trong phần khuyết, trên nền
          thẻ, hoá ra đọc ra như thể vết khuyết sinh ra để chứa nó. */}
      <div className="relative">
        <div className="relative aspect-3/2 overflow-hidden rounded-xl" style={notchStyle}>
          {/* Trợ năng: nhãn placeholder là tên destination chính, KHÔNG phải
              tour.title — title đã nằm ngay ở <h3> bên dưới, lặp lại là trình
              đọc màn hình đọc hai lần. */}
          <SlotImage
            image={tour.cover}
            label={primary?.name}
            className="absolute inset-0"
            sizes={COVER_SIZES}
          />
        </div>

        {/* Hai nhánh huy hiệu, giữ nguyên luật của bản cũ: có giảm giá thì hiện
            %, không giảm giá mà `isFeatured` thì hiện "Featured". Hai thứ không
            bao giờ cùng lúc quan trọng bằng nhau — sự thật về giá thắng nhãn
            tiếp thị. */}
        {discount !== null ? (
          <span className="absolute top-3 left-3 inline-flex h-[22px] items-center rounded-full bg-sale px-2 text-xs font-semibold text-sale-foreground tabular-nums">
            −{discount}%
          </span>
        ) : tour.isFeatured ? (
          <span className="absolute top-3 left-3 inline-flex h-[22px] items-center rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground">
            {t.featuredBadge}
          </span>
        ) : null}

        {/* `z-10` vì lớp phủ bấm-cả-thẻ (`after:` của link tiêu đề) nằm SAU
            trong DOM nên mặc định vẽ đè lên nút này. */}
        <div className="absolute top-2.5 right-2.5 z-10">
          <WishlistHeart
            tourId={tour.id}
            tourTitle={tour.title}
            className="size-[34px] rounded-full border-border bg-card text-muted-foreground shadow-(--shadow-card) hover:border-primary hover:bg-card hover:text-primary"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2 px-1 pt-3.5 pb-1">
        {/* Băng dữ kiện — đứng đúng chỗ hàng ô màu của mẫu gốc */}
        <div
          className={`flex h-4 items-center gap-x-3.5 text-[11px] leading-4 font-medium tracking-[0.06em] text-muted-foreground uppercase ${CLAMP.oneLine}`}
        >
          <span className="inline-flex shrink-0 items-center gap-1.5">
            <MapPinIcon className="size-3" aria-hidden="true" />
            {primary?.name}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5">
            <ClockIcon className="size-3" aria-hidden="true" />
            {t.durationValue(tour.durationDays)}
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5">
            <UsersIcon className="size-3" aria-hidden="true" />
            {t.maxGroup(tour.maxGroupSize)}
          </span>
        </div>

        <h3 className={`font-heading text-xl leading-[1.3] font-medium ${CLAMP.title}`}>
          {/* Lớp phủ vô hình biến cả thẻ thành vùng bấm; nút tim và CTA phía
              dưới phải nổi lên trên bằng z-index. */}
          <a href={href} className="transition-colors after:absolute after:inset-0">
            {tour.title}
          </a>
        </h3>

        {/* Tóm tắt nullable — vẫn GIỮ CHỖ 2 dòng khi rỗng để thẻ cạnh nó không
            cao hơn hẳn. */}
        <p className={`text-[13.5px] leading-5 text-pretty text-muted-foreground ${CLAMP.summary}`}>
          {tour.summary ?? ''}
        </p>

        <div className="flex h-6 items-center gap-2.5 overflow-hidden">
          {/* ratingAvg null = CHƯA AI đánh giá. Bỏ hẳn dòng sao thay vì hiện
              "0.0" hay 5 sao rỗng. */}
          <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px]">
            {tour.ratingAvg === null ? (
              <span className="text-muted-foreground">{t.notRated}</span>
            ) : (
              <>
                <StarIcon className="size-3.5 fill-rating text-rating" aria-hidden="true" />
                <span className="font-semibold">{tour.ratingAvg.toFixed(1)}</span>
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
                className="inline-flex h-[22px] shrink-0 items-center rounded-full border px-2.5 text-[11.5px] text-muted-foreground"
              >
                {chip}
              </span>
            ))}
          </span>
        </div>

        <div className="mt-1 flex items-end justify-between gap-3 border-t pt-3">
          <span className="flex items-baseline gap-2">
            {tour.compareAtPrice ? (
              <span className="text-sm text-price-compare tabular-nums line-through">
                {formatMoney(tour.compareAtPrice, tour.currency)}
              </span>
            ) : null}
            <span className="font-heading text-[22px] leading-7 font-semibold tabular-nums">
              {formatMoney(tour.basePrice, tour.currency)}
            </span>
            <span className="text-[11.5px] text-muted-foreground">{t.perPerson}</span>
          </span>
          {/* `relative z-10` cùng lý do với nút tim — nổi lên trên lớp phủ. */}
          <ButtonLink size="sm" href={href} className="relative z-10 h-[34px] rounded-full px-4">
            {t.viewTour}
          </ButtonLink>
        </div>
      </div>
    </article>
  );
}
