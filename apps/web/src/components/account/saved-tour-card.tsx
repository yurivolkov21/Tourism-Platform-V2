import type { WishlistItem } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { cn } from '@tourism/ui/lib/utils';
import { ClockIcon, HeartIcon, StarIcon } from 'lucide-react';
import { SlotImage } from '@/components/slot-image';
import { formatMoney } from '@/lib/tours';
import { formatSavedDate } from '@/lib/wishlist';

/**
 * `sizes` của ảnh bìa theo số cột của `SavedGrid`: từ `lg` ba cột trong khung tối đa 1152px, khe
 * 24px → mỗi ảnh tối đa 368px; từ `sm` hai cột ≈ nửa màn hình; dưới `sm` một cột trọn bề ngang.
 */
const COVER_SIZES = '(min-width: 1024px) 368px, (min-width: 640px) 50vw, 100vw';

/**
 * `id` của nút tim một thẻ. `SavedGrid` dùng nó để biết focus có đang ở tim của thẻ sắp rời lưới
 * hay không, và để dời focus sang tim của thẻ kế (cùng nếp `BOOKINGS_COUNT_ID` của My bookings:
 * tìm đích bằng `id`, không giữ ref xuyên component).
 */
export function savedHeartId(tourId: string): string {
  return `saved-heart-${tourId}`;
}

/**
 * Thẻ MỘT tour đã lưu (spec 09/10 §3, phương án A) — không viền, ảnh trên chữ dưới như thẻ tour
 * của site.
 *
 * - Ảnh bìa 4:3 bo góc; nút tim 36px LUÔN hiện ở góc phải trên ảnh (cả điện thoại, nơi không có
 *   hover), tim đặc màu chủ đạo, tên đọc "Remove {tour} from saved tours". Đây là nút HÀNH ĐỘNG
 *   thuần, không `aria-pressed`: thẻ rời lưới ngay khi bấm nên không bao giờ có trạng thái "chưa
 *   bấm" để bật lại, còn `aria-pressed="true"` cộng nhãn "Remove …" thì trình đọc màn hình đọc
 *   "Remove …, toggle button, pressed" — tự mâu thuẫn (nút bật/tắt thật là `WishlistHeart`, đổi
 *   trạng thái tại chỗ). Nút là ANH EM của ảnh và mang `z-10`: lớp phủ bấm-cả-thẻ (`after:` của
 *   link tiêu đề) nằm sau trong DOM nên mặc định vẽ đè lên nó; còn ảnh xám mang `filter` (tạo
 *   stacking context), nên nút và nhãn không được nằm TRONG khung ảnh.
 * - Dưới ảnh: "Saved {ngày}" (ngày lịch Việt Nam của `addedAt`) → tên tour (tối đa 2 dòng, giữ
 *   chỗ 2 dòng để hàng thẻ thẳng nhau) → số ngày kèm sao và số lượt (chưa ai đánh giá thì bỏ hẳn
 *   phần sao, không in nhãn thay) → giá.
 * - Tour không còn bán (`unavailable`): ảnh xám, nhãn "No longer available" góc trái trên ảnh,
 *   tên muted, không giá, KHÔNG link — trang tour đã gỡ, link chết còn tệ hơn thẻ không bấm
 *   được; tim vẫn bỏ lưu được.
 *
 * Vì sao không dùng `TourCard`: `WishlistItemSchema` chỉ mang tên, giá, số ngày, sao và ảnh bìa
 * — nhét vào `TourCardVM` là phải BỊA chuyên mục, cỡ nhóm, cờ nổi bật. Thẻ riêng chỉ dựng đúng
 * thứ dữ liệu có.
 */
export function SavedTourCard({
  item,
  today,
  onRemove,
}: {
  item: WishlistItem;
  /** Ngày lịch Việt Nam do server tính (`todayDateString`) — quyết có in năm hay không. */
  today: string;
  onRemove: () => void;
}) {
  const t = messages.accountSaved;
  const tc = messages.toursPage;
  const off = item.unavailable;

  return (
    <article className="group relative flex h-full flex-col">
      <div className="relative">
        <SlotImage
          image={item.cover}
          label={item.destinationName ?? undefined}
          className={cn('aspect-4/3 w-full rounded-xl', off && 'opacity-75 grayscale')}
          sizes={COVER_SIZES}
        />
        {off ? (
          <span className="absolute top-2.5 left-2.5 rounded-full bg-background px-2.5 py-0.5 text-[11px] font-semibold text-foreground">
            {t.unavailable}
          </span>
        ) : null}
        <Button
          id={savedHeartId(item.tourId)}
          type="button"
          variant="ghost"
          size="icon-lg"
          aria-label={t.removeAria(item.title)}
          onClick={onRemove}
          className="absolute top-2.5 right-2.5 z-10 rounded-full bg-background/80 text-primary-emphasis shadow-(--shadow-card) backdrop-blur-sm hover:bg-background hover:text-primary-emphasis dark:hover:bg-background"
        >
          <HeartIcon aria-hidden="true" className="fill-current" />
        </Button>
      </div>

      <div className="pt-3">
        <p className="text-[0.625rem] font-bold tracking-[0.15em] text-muted-foreground uppercase">
          {t.savedOn(formatSavedDate(item.addedAt, today))}
        </p>
        <h3
          className={cn(
            'mt-1.5 line-clamp-2 min-h-[2lh] font-heading text-lg leading-snug font-medium',
            off
              ? 'text-muted-foreground'
              : 'text-foreground transition-colors group-hover:text-primary-emphasis',
          )}
        >
          {off ? (
            item.title
          ) : (
            // Cả thẻ là MỘT vùng bấm qua `after:inset-0`, cùng thủ thuật `TourCard`.
            <a href={`/tours/${item.slug}`} className="after:absolute after:inset-0">
              {item.title}
            </a>
          )}
        </h3>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <ClockIcon aria-hidden="true" className="size-3.5" />
            {tc.durationValue(item.durationDays)}
          </span>
          {/* `ratingAvg` null = CHƯA AI đánh giá, khác hẳn 0 điểm — bỏ hẳn phần sao. */}
          {item.ratingAvg === null ? null : (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <StarIcon aria-hidden="true" className="size-3.5 fill-rating text-rating" />
              <span className="font-medium text-foreground">{item.ratingAvg.toFixed(1)}</span>
              <span>({item.ratingCount.toLocaleString('en-US')})</span>
            </span>
          )}
        </p>
        {off ? null : (
          <p className="mt-1.5 font-heading text-lg font-semibold text-foreground tabular-nums">
            {formatMoney(item.basePrice, item.currency)}
          </p>
        )}
      </div>
    </article>
  );
}
