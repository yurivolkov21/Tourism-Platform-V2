'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@tourism/ui/components/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@tourism/ui/components/dropdown-menu';
import { Rating } from '@tourism/ui/components/reui/rating';
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon, ImageIcon, XIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ReviewCard } from '@/components/tours/review-card';
import {
  fetchTourReviewsFromBrowser,
  type TourReviewsPageVM,
  type TourReviewsQuery,
} from '@/lib/api/tours';

/** Sáu review vừa một khung modal mà không phải cuộn dài. */
const PAGE_SIZE = 6;

type Sort = NonNullable<TourReviewsQuery['sort']>;

const SORTS: Sort[] = ['newest', 'oldest', 'highest', 'lowest'];

/**
 * Modal "Show all reviews" (spec §5.2).
 *
 * SẮP XẾP VÀ LỌC ĐI QUA SERVER, không sắp lại ở client: client chỉ nắm ĐÚNG
 * trang đang xem, nên "highest first" tính tại chỗ sẽ mâu thuẫn với trang kế.
 * Thứ tự thật (`[authorDeleted asc, sort, id desc]`) chỉ server biết.
 *
 * Vì vậy modal tự nạp dữ liệu qua `fetchTourReviewsFromBrowser` thay vì nhận
 * mảng review dựng sẵn từ trang: trang là SSG, nó chỉ có trang 1 của bộ lọc mặc
 * định.
 */
export function ReviewsDialog({
  open,
  onOpenChange,
  tourSlug,
  tourTitle,
  ratingAvg,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourSlug: string;
  tourTitle: string;
  ratingAvg?: number | null;
}) {
  const t = messages.tourDetail.dialogs;
  const [sort, setSort] = useState<Sort>('newest');
  const [rating, setRating] = useState<number | null>(null);
  const [withPhotos, setWithPhotos] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<TourReviewsPageVM | null>(null);
  const [loading, setLoading] = useState(false);

  // Đếm request để bỏ qua phản hồi VỀ SAU của một request cũ: bấm nhanh hai bộ
  // lọc thì request đầu có thể về sau và ghi đè kết quả đúng bằng kết quả cũ.
  const requestId = useRef(0);

  useEffect(() => {
    if (!open) return;
    const id = ++requestId.current;
    setLoading(true);
    fetchTourReviewsFromBrowser(tourSlug, {
      page,
      pageSize: PAGE_SIZE,
      sort,
      ...(rating ? { rating } : {}),
      ...(withPhotos ? { withPhotos: true } : {}),
    })
      .then((result) => {
        if (id !== requestId.current) return;
        setData(result);
      })
      .finally(() => {
        if (id === requestId.current) setLoading(false);
      });
  }, [open, tourSlug, page, sort, rating, withPhotos]);

  /** Mọi thay đổi bộ lọc phải kéo về trang 1 — trang 4 của bộ lọc cũ có thể
      không tồn tại trong bộ lọc mới, và khách sẽ thấy một khung rỗng. */
  function applyFilter(change: () => void) {
    setPage(1);
    change();
  }

  const filtered = rating !== null || withPhotos;
  const total = data?.total ?? 0;
  const totalPages = data?.totalPages ?? 1;
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const sortLabel = {
    newest: t.sortNewest,
    oldest: t.sortOldest,
    highest: t.sortHighest,
    lowest: t.sortLowest,
  }[sort];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        // Đóng rồi mở lại phải về trạng thái đầu: giữ bộ lọc cũ khiến khách mở
        // ra thấy "2 kết quả" mà không nhớ vì sao.
        if (!next) {
          setPage(1);
          setRating(null);
          setWithPhotos(false);
          setSort('newest');
        }
      }}
    >
      <DialogContent showCloseButton={false} className="w-full gap-0 p-0 sm:max-w-3xl">
        <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4">
          <div className="min-w-0">
            <DialogTitle className="font-heading text-xl leading-[26px] font-medium">
              {t.allReviewsTitle}
            </DialogTitle>
            <p className="mt-1 truncate text-[13px] leading-[20px] text-muted-foreground">
              {ratingAvg != null
                ? t.reviewsSubtitle(tourTitle, ratingAvg.toFixed(1), total)
                : `${tourTitle} · ${messages.tourDetail.reviewCount(total)}`}
            </p>
          </div>
          <DialogClose
            render={
              <Button variant="ghost" size="icon-sm" aria-label={t.close}>
                <XIcon />
              </Button>
            }
          />
        </div>

        <div className="flex flex-wrap items-center gap-4 px-6 pb-4">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`${t.sortBy}: ${sortLabel}`}
                  className="justify-between gap-6"
                >
                  {sortLabel}
                  <ChevronDownIcon className="text-muted-foreground" />
                </Button>
              }
            />
            <DropdownMenuContent align="start" className="min-w-44">
              <DropdownMenuRadioGroup
                value={sort}
                onValueChange={(value) => applyFilter(() => setSort(value as Sort))}
              >
                {SORTS.map((key) => (
                  <DropdownMenuRadioItem key={key} value={key}>
                    {
                      {
                        newest: t.sortNewest,
                        oldest: t.sortOldest,
                        highest: t.sortHighest,
                        lowest: t.sortLowest,
                      }[key]
                    }
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-3">
            <Rating
              rating={rating ?? 0}
              editable
              size="sm"
              className="gap-0"
              starClassName="size-4"
              // Bấm lại chính ngôi sao đang lọc thì bỏ lọc — không cần một nút
              // "Clear" riêng cho thứ đã có sẵn chỗ bấm.
              onRatingChange={(next) =>
                applyFilter(() => setRating((prev) => (prev === next ? null : next)))
              }
            />
            <span className="text-[13px] leading-[20px] text-muted-foreground">
              {rating ? t.starsOnly(rating) : t.anyRating}
            </span>
          </div>

          <Button
            variant={withPhotos ? 'default' : 'outline'}
            size="sm"
            aria-pressed={withPhotos}
            onClick={() => applyFilter(() => setWithPhotos((prev) => !prev))}
          >
            <ImageIcon />
            {t.withPhotos}
          </Button>
        </div>

        {/* data-lenis-prevent: Lenis chặn wheel trên cả tài liệu nên lăn chuột
            trong vùng cuộn lồng lại cuộn TRANG CHÍNH. */}
        <div
          data-lenis-prevent
          className="max-h-[58vh] overflow-y-auto border-t border-border px-6"
        >
          {data === null && loading ? (
            <p className="py-10 text-center text-sm leading-[20px] text-muted-foreground">
              {t.loadingReviews}
            </p>
          ) : data && data.items.length === 0 ? (
            <p className="py-10 text-center text-sm leading-[20px] text-muted-foreground">
              {t.noReviewsMatch}
            </p>
          ) : (
            <ul className={loading ? 'opacity-60' : undefined}>
              {data?.items.map((review) => (
                <li key={review.id} className="border-b border-border py-5 last:border-b-0">
                  <ReviewCard review={review} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-4">
          <p className="text-[13px] leading-[20px] text-muted-foreground tabular-nums">
            {filtered ? t.showingMatching(from, to, total) : t.showingRange(from, to, total)}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeftIcon />
              {t.prevPage}
            </Button>
            <span className="px-1 font-mono text-xs leading-[16px] text-muted-foreground tabular-nums">
              {t.pageOf(page, totalPages)}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              {t.nextPage}
              <ChevronRightIcon />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
