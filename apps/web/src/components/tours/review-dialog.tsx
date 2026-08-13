'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@tourism/ui/components/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@tourism/ui/components/dropdown-menu';
import { cn } from '@tourism/ui/lib/utils';
import {
  ArrowDownWideNarrowIcon,
  ArrowUpNarrowWideIcon,
  CheckIcon,
  ChevronDownIcon,
  ClockIcon,
  HistoryIcon,
  ImageIcon,
  StarIcon,
  XIcon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { PANEL_BTN_SM } from '@/components/tours/panel-button';
import { ReviewCard } from '@/components/tours/review-card';
import {
  fetchTourReviewsFromBrowser,
  type TourReviewsPageVM,
  type TourReviewsQuery,
} from '@/lib/api/tours';
import { REVIEWS_PAGE_SIZE, reviewRange, toggleStarFilter } from '@/lib/tour-detail';

type SortKey = NonNullable<TourReviewsQuery['sort']>;

const SORT_ITEMS: { key: SortKey; icon: typeof ClockIcon }[] = [
  { key: 'newest', icon: ClockIcon },
  { key: 'oldest', icon: HistoryIcon },
  { key: 'highest', icon: ArrowDownWideNarrowIcon },
  { key: 'lowest', icon: ArrowUpNarrowWideIcon },
];

function sortLabel(key: SortKey): string {
  const t = messages.tourDetail.dialogs;
  return {
    newest: t.sortNewest,
    oldest: t.sortOldest,
    highest: t.sortHighest,
    lowest: t.sortLowest,
  }[key];
}

/**
 * Modal "Show all reviews" — dựng bám `.dlg-box` (720 rộng) + `.rv-ctl` của
 * wireframe; khung ngoài dùng chung khuôn với modal "All dates".
 *
 * SẮP XẾP VÀ LỌC ĐI QUA SERVER, không sắp lại ở client. Client chỉ nắm MỘT
 * trang: "highest first" tính tại chỗ sẽ sắp đúng 6 review đang cầm rồi mâu
 * thuẫn với trang kế. Mỗi lần đổi sort/sao/ảnh là một lần gọi lại
 * `reviews.listByTour` với đúng tham số đó — đây là lý do contract nở thêm
 * `sort`/`rating`/`withPhotos` ở T1.
 *
 * `breakdown` KHÔNG áp bộ lọc sao (server đảm bảo), nên con số trên từng nút
 * sao đứng yên khi khách bấm qua lại — nếu áp, bấm "4 sao" sẽ làm bốn nút kia
 * về 0 và không còn đường quay lại bằng mắt.
 */
export function ReviewDialog({
  slug,
  tourTitle,
  open,
  onOpenChange,
  initialPage,
  ratingAvg,
}: {
  slug: string;
  tourTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Trang 1 đã fetch phía server — mở modal ra là có chữ ngay, không nháy rỗng. */
  initialPage: TourReviewsPageVM;
  ratingAvg: number | null;
}) {
  const t = messages.tourDetail.dialogs;
  const [sort, setSort] = useState<SortKey>('newest');
  const [rating, setRating] = useState<number | undefined>(undefined);
  const [withPhotos, setWithPhotos] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<TourReviewsPageVM>(initialPage);
  const [loading, setLoading] = useState(false);
  const [hoverStar, setHoverStar] = useState(0);

  // Trang 1 mặc định đã nằm sẵn trong `initialPage`, nên bỏ qua lần fetch đầu:
  // gọi lại ngay lúc mở là in đúng thứ đang hiện, tốn một vòng mạng và một
  // nháy "Loading…" cho không.
  const isDefaultView = sort === 'newest' && rating === undefined && !withPhotos && page === 1;

  useEffect(() => {
    if (!open || isDefaultView) return;
    let cancelled = false;
    setLoading(true);
    fetchTourReviewsFromBrowser(slug, {
      page,
      pageSize: REVIEWS_PAGE_SIZE,
      sort,
      rating,
      withPhotos,
    })
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, isDefaultView, slug, page, sort, rating, withPhotos]);

  // Về bản mặc định thì trả lại dữ liệu server, không giữ kết quả lọc cũ.
  useEffect(() => {
    if (isDefaultView) setData(initialPage);
  }, [isDefaultView, initialPage]);

  const filtered = rating !== undefined || withPhotos;
  const { from, to } = reviewRange(page, REVIEWS_PAGE_SIZE, data.total);
  const totalPages = Math.max(1, data.totalPages);
  const breakdown = data.breakdown as Record<string, number>;

  /** Mọi lần đổi bộ lọc phải về trang 1: giữ trang 4 rồi lọc còn 5 kết quả là
      mở ra một trang trống. */
  function applyFilter(next: () => void) {
    setPage(1);
    next();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        // `[--radius:1rem]`: dialog portal ra `body` nên KHÔNG thừa hưởng base
        // bo góc của wireframe từ container trang. Cùng lý do ở DepartureDialog.
        className="flex max-h-[min(760px,100%)] w-full flex-col gap-0 rounded-lg border border-border p-0 [--radius:1rem] sm:max-w-180"
      >
        {/* `.dlg-head` — pad 20/24/16, có thêm hàng `.rv-ctl` cao 32, gap 12. */}
        <div className="relative border-b border-border px-6 pt-5 pb-4">
          <DialogTitle className="font-heading text-xl leading-[26px] font-medium">
            {t.allReviewsTitle}
          </DialogTitle>
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">
            {t.reviewsSubtitle(
              tourTitle,
              ratingAvg === null ? '—' : ratingAvg.toFixed(1),
              initialPage.total,
            )}
          </p>
          <DialogClose
            render={
              <Button
                variant="outline"
                size="icon-sm"
                aria-label={t.close}
                className="absolute top-4 right-4 size-8 rounded-sm"
              >
                <XIcon />
              </Button>
            }
          />

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {/* `.dd-trigger` — 150×32. Dùng DropdownMenu của repo chứ không dựng
                menu tay: nó lo sẵn tiêu điểm, Escape và bấm-ra-ngoài. */}
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="outline"
                    className={cn(PANEL_BTN_SM, 'w-[150px] justify-start gap-2')}
                  >
                    <span className="truncate">{sortLabel(sort)}</span>
                    <ChevronDownIcon className="ml-auto size-3.5 text-muted-foreground" />
                  </Button>
                }
              />
              <DropdownMenuContent align="start" className="min-w-56">
                {/* Nhãn PHẢI nằm trong `DropdownMenuGroup`: Base UI dựng
                    `GroupLabel` trên context của Group, để ngoài là ném
                    "MenuGroupContext is missing" ngay lúc mở menu. */}
                <DropdownMenuGroup>
                  <DropdownMenuLabel>{t.sortBy}</DropdownMenuLabel>
                  {SORT_ITEMS.map(({ key, icon: Icon }) => (
                    <DropdownMenuItem
                      key={key}
                      onClick={() => applyFilter(() => setSort(key))}
                      className={cn('gap-2.5', key === sort && 'font-medium')}
                    >
                      <Icon className="size-4 text-muted-foreground" />
                      <span>{sortLabel(key)}</span>
                      {key === sort ? (
                        <CheckIcon className="ml-auto size-3.5 text-primary-emphasis" />
                      ) : null}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>

            <span aria-hidden="true" className="h-6 w-px bg-border" />

            {/* Dải sao chọn được thay cho sáu nút rời: bấm sao thứ N lọc đúng N
                sao, bấm lại chính nó bỏ lọc (`toggleStarFilter`). Nhãn bên cạnh
                nói rõ trạng thái — chỉ nhìn sao thì không phân biệt được
                "đang lọc 4 sao" với "chưa lọc". */}
            <div className="inline-flex items-center gap-2.5">
              {/* `<fieldset>` chứ không phải `<span role="group">`: cùng ngữ
                  nghĩa nhưng là thẻ có sẵn, và Biome chặn đúng chỗ này. Nhãn
                  nhóm nói TÊN cụm điều khiển, không nói trạng thái — trạng thái
                  đã có ở dòng chữ ngay bên phải. */}
              <fieldset
                className="m-0 inline-flex gap-0.5 border-0 p-0"
                onMouseLeave={() => setHoverStar(0)}
                aria-label={t.filterByRating}
              >
                {[1, 2, 3, 4, 5].map((star) => {
                  const lit = star <= (hoverStar || (rating ?? 0));
                  return (
                    <button
                      key={star}
                      type="button"
                      aria-pressed={rating === star}
                      aria-label={t.starsOnly(star)}
                      onMouseEnter={() => setHoverStar(star)}
                      onClick={() =>
                        applyFilter(() => setRating((cur) => toggleStarFilter(cur, star)))
                      }
                      className="cursor-pointer px-px"
                    >
                      <StarIcon
                        className={cn(
                          'size-[19px]',
                          lit ? 'fill-rating text-rating' : 'text-rating-muted',
                        )}
                      />
                    </button>
                  );
                })}
              </fieldset>
              <span className="min-w-24 text-[13px] text-muted-foreground">
                {rating === undefined ? t.anyRating : t.starsOnly(rating)}
                {rating === undefined ? null : (
                  <span className="text-muted-foreground"> · {breakdown[String(rating)] ?? 0}</span>
                )}
              </span>
            </div>

            <span aria-hidden="true" className="h-6 w-px bg-border" />

            <Button
              type="button"
              variant={withPhotos ? 'default' : 'outline'}
              aria-pressed={withPhotos}
              onClick={() => applyFilter(() => setWithPhotos((v) => !v))}
              className={cn(PANEL_BTN_SM, 'gap-[7px]')}
            >
              <ImageIcon className="size-3.5" />
              {t.withPhotos}
            </Button>
          </div>
        </div>

        {/* `.dlg-scroll` — pad 8/24/16. data-lenis-prevent: Lenis chặn wheel trên
            cả tài liệu nên lăn chuột trong vùng cuộn lồng lại cuộn TRANG CHÍNH. */}
        <div data-lenis-prevent className="min-h-0 flex-1 overflow-y-auto px-6 pt-2 pb-4">
          {loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t.loadingReviews}</p>
          ) : data.items.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t.noReviewsMatch}</p>
          ) : (
            data.items.map((review) => <ReviewCard key={review.id} review={review} />)
          )}
        </div>

        {/* `.dlg-foot` — viền trên, pad 16/24, hai đầu. */}
        <div className="flex items-center justify-between gap-4 border-t border-border px-6 py-4">
          <p className="text-[13px] text-muted-foreground tabular-nums">
            {filtered
              ? t.showingMatching(from, to, data.total)
              : t.showingRange(from, to, data.total)}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className={PANEL_BTN_SM}
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ‹ {t.prevPage}
            </Button>
            <span className="font-mono text-xs text-muted-foreground tabular-nums">
              {t.pageOf(Math.min(page, totalPages), totalPages)}
            </span>
            <Button
              type="button"
              variant="outline"
              className={PANEL_BTN_SM}
              disabled={page >= totalPages || data.total === 0}
              onClick={() => setPage((p) => p + 1)}
            >
              {t.nextPage} ›
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
