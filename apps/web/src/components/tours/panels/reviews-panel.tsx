'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { Rating } from '@tourism/ui/components/reui/rating';
import { useState } from 'react';
import { ReviewCard } from '@/components/tours/review-card';
import { ReviewsDialog } from '@/components/tours/reviews-dialog';
import type { TourDetailVM, TourReviewsPageVM } from '@/lib/api/tours';
import { ratingHistogram } from '@/lib/tour-detail';

/** Số review ở lại trên tab làm mồi. Phần còn lại đi qua modal — hai cái là đủ
    để nghe ra giọng điệu mà không biến tab thành một danh sách dài. */
const INLINE_COUNT = 2;

/**
 * Tab 4 — điểm trung bình, phân bố sao, hai review mồi.
 *
 * KHÔNG có nút "Write a review": `reviews.create` cần `bookingCode` + booking
 * `PAID` + chuyến ĐÃ kết thúc (xem `review-eligibility.ts`), mà trang tour công
 * khai không có mã nào trong tay. Nút đó là hứa thứ sản phẩm không giữ —
 * ADR-0022 mục Hệ quả.
 */
export function ReviewsPanel({ tour, page }: { tour: TourDetailVM; page: TourReviewsPageVM }) {
  const t = messages.tourDetail;
  const [dialogOpen, setDialogOpen] = useState(false);
  const rows = ratingHistogram(page.breakdown);

  if (page.total === 0) {
    return (
      <div className="max-w-3xl rounded-xl border border-dashed border-border px-6 py-9 text-center">
        <p className="font-heading text-base leading-[22px] font-medium">
          {t.reviewsTab.emptyTitle}
        </p>
        <p className="mx-auto mt-2 max-w-prose text-sm leading-[22px] text-muted-foreground">
          {t.reviewsTab.emptyBody}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid gap-10 sm:grid-cols-[240px_minmax(0,1fr)]">
        <div>
          <p className="font-heading text-5xl leading-[54px] font-medium tabular-nums">
            {(tour.ratingAvg ?? 0).toFixed(1)}
          </p>
          <Rating
            rating={tour.ratingAvg ?? 0}
            size="sm"
            className="mt-2.5 gap-0"
            starClassName="size-4"
            aria-label={t.reviews.ratingLabel(tour.ratingAvg ?? 0)}
          />
          <p className="mt-2.5 text-[13px] leading-[20px] text-muted-foreground">
            {t.reviewsTab.basedOn(page.total)}
          </p>
          <Button className="mt-5" onClick={() => setDialogOpen(true)}>
            {t.reviewsTab.showAll}
          </Button>
          <p className="mt-3 max-w-[28ch] text-xs leading-[18px] text-muted-foreground">
            {t.reviewsTab.onlyFinished}
          </p>
        </div>

        <div className="flex flex-col justify-center gap-3.5">
          {rows.map((row) => (
            <div
              key={row.star}
              className="grid grid-cols-[28px_minmax(0,1fr)_28px] items-center gap-3"
            >
              <span className="font-mono text-xs leading-[16px] text-muted-foreground">
                {row.star}★
              </span>
              {/* Rãnh dùng `--border`, KHÔNG `--muted`: muted chỉ hơn nền 1.26:1
                  nên hai mép của thanh 6px bị khử răng cưa ăn mòn, mắt đọc thanh
                  rỗng thành sợi mảnh trong khi thanh đã tô đọc đủ 6px — đó là
                  gốc của cảm giác "các đường to nhỏ khác nhau".
                  `display:block` trên phần tô là BẮT BUỘC: span inline không
                  nhận width/height.
                  Phần tô dùng `--primary-emphasis` chứ không `--primary`: đo
                  trên trang thật, primary/border chỉ đạt 1.77:1 ở chế độ TỐI
                  (sáng 3.0) — dưới ngưỡng 3:1 của WCAG 1.4.11 cho đối tượng đồ
                  hoạ mang thông tin. primary-emphasis cho 3.0 (sáng) và 4.32
                  (tối). */}
              <span className="block h-1.5 overflow-hidden rounded-full bg-border">
                <span
                  data-testid={`rating-bar-${row.star}`}
                  className="block h-full rounded-full bg-primary-emphasis"
                  style={{ width: `${row.percent}%` }}
                />
              </span>
              <span className="text-right font-mono text-xs leading-[16px] text-muted-foreground tabular-nums">
                {row.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      <ul className="mt-9 flex flex-col gap-6 border-t border-border pt-6">
        {page.items.slice(0, INLINE_COUNT).map((review) => (
          <li key={review.id} className="border-b border-border pb-6 last:border-b-0 last:pb-0">
            <ReviewCard review={review} />
          </li>
        ))}
      </ul>

      <p className="mt-5 text-xs leading-[18px] text-muted-foreground">{t.reviewsTab.ordering}</p>

      <ReviewsDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        tourSlug={tour.slug}
        tourTitle={tour.title}
        ratingAvg={tour.ratingAvg}
      />
    </div>
  );
}
