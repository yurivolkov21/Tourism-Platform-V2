'use client';

import { messages } from '@tourism/i18n';
import { Button } from '@tourism/ui/components/button';
import { cn } from '@tourism/ui/lib/utils';
import { useState } from 'react';
import { RevealItem } from '@/components/motion/reveal-item';
import { PANEL_BTN_SM } from '@/components/tours/panel-button';
import { ReviewCard, StarRow } from '@/components/tours/review-card';
import { ReviewDialog } from '@/components/tours/review-dialog';
import type { TourDetailVM, TourReviewsPageVM } from '@/lib/api/tours';
import { STAGGER } from '@/lib/motion';
import { ratingHistogram } from '@/lib/tour-detail';

/** Số review làm mồi trong tab; phần còn lại đi qua modal. Con số bản duyệt. */
const PREVIEW_COUNT = 2;

/**
 * Tab 4 — tóm tắt đánh giá, dựng bám `.rvtop` của wireframe: lưới
 * `minmax(0,220px) minmax(0,1fr)` gap 32, cột trái là điểm số + CTA, cột phải
 * là biểu đồ năm mức sao, dưới cùng là hai review mồi trong khung 768.
 *
 * BA NGUỒN SỐ PHẢI KHỚP NHAU và đã đo là khớp trên dữ liệu thật: điểm lớn dùng
 * `tour.ratingAvg` (cột đã chuẩn hoá, cũng là con số mọi TourCard đang hiện),
 * "Based on N" dùng `tour.ratingCount`, biểu đồ dùng `breakdown` từ
 * `reviews.listByTour`. Đo `ha-giang-loop-4d`: avg 4.4 · count 5 · breakdown
 * 3★1 4★1 5★3 (tổng 5, trung bình 22/5 = 4.4). Nếu ba con số này lệch nhau thì
 * lỗi nằm ở chỗ cập nhật `ratingAvg` phía API, không phải ở đây — đừng vá bằng
 * cách tính lại avg từ breakdown, làm vậy là giấu lỗi.
 *
 * Bề rộng cột biểu đồ dùng `count/total` (tỉ lệ trên TỔNG, đúng nghĩa "bao
 * nhiêu phần trăm người chấm mức này"), KHÔNG phải tỉ lệ với cột cao nhất —
 * chuẩn hoá theo cột cao nhất làm mức phổ biến nhất luôn đầy 100% ở mọi tour.
 */
export function ReviewsPanel({
  tour,
  reviews,
}: {
  tour: TourDetailVM;
  reviews: TourReviewsPageVM;
}) {
  const t = messages.tourDetail.reviewsTab;
  const [open, setOpen] = useState(false);

  if (tour.ratingCount === 0) {
    // Chưa ai đánh giá: KHÔNG vẽ biểu đồ năm cột 0% — nó đọc ra như "ai cũng
    // chấm thấp" chứ không phải "chưa có dữ liệu".
    return (
      <div className="rounded-md border border-dashed border-border px-6 py-14 text-center">
        <p className="font-medium text-foreground">{t.emptyTitle}</p>
        <p className="mt-1.5 text-sm text-muted-foreground">{t.emptyBody}</p>
      </div>
    );
  }

  const average = tour.ratingAvg ?? 0;
  const histogram = ratingHistogram(reviews.breakdown as Record<string, number>);

  return (
    <div>
      <div className="grid items-start gap-8 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
        <div>
          <p className="font-heading text-[40px] leading-[44px] font-medium text-foreground tabular-nums">
            {average.toFixed(1)}
          </p>
          {/* Sao làm tròn về mức gần nhất — nửa sao vẽ được nhưng đọc ra như
              một điểm số thứ hai cạnh con số đã in to ngay trên nó. */}
          <StarRow rating={Math.round(average)} className="my-1.5" />
          <p className="text-[13px] text-muted-foreground">{t.basedOn(tour.ratingCount)}</p>
          <Button type="button" className={cn('mt-4', PANEL_BTN_SM)} onClick={() => setOpen(true)}>
            {t.showAll}
          </Button>
          {/* `leading-[23px]`: chữ trong `.rvtop` của wireframe thừa hưởng
              line-height 23 của `.pane`, không phải 16 mặc định của `text-xs` —
              hai dòng ghi chú hụt 14px nếu để mặc định. */}
          <p className="mt-2.5 max-w-50 text-xs leading-[23px] text-muted-foreground">
            {t.onlyFinished}
          </p>
        </div>

        <div>
          <div>
            {histogram.map((row) => (
              // `leading-[23px]` chứ không để `text-xs` tự đặt 16: `.bar` của
              // wireframe không khai line-height nên thừa hưởng 23 của `.pane`,
              // và mỗi hàng thấp đi 7px là cả biểu đồ hụt 35px so với bản duyệt.
              <div
                key={row.star}
                className="flex items-center gap-2 py-0.5 text-[12px] leading-[23px]"
              >
                <span className="w-[18px] font-mono text-muted-foreground tabular-nums">
                  {row.star}★
                </span>
                {/* `--primary-emphasis` chứ không `--primary`: đo bằng canvas
                    readback, primary trên rãnh chỉ đạt 1.77:1 ở chế độ TỐI,
                    dưới ngưỡng 3:1 của WCAG 1.4.11. */}
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-border">
                  <span
                    className="block h-full rounded-full bg-primary-emphasis"
                    style={{ width: `${row.percent.toFixed(2)}%` }}
                  />
                </span>
                <span className="w-[22px] text-right text-muted-foreground tabular-nums">
                  {row.count}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-[23px] text-muted-foreground">{t.ordering}</p>
        </div>
      </div>

      {/* Hai review mồi. Khung 768 giống `.pane.narrow` của tab Itinerary: dòng
          văn dài quá 768 là đọc mỏi mắt, mà đây là khối chữ dày nhất tab này. */}
      <div className="mt-7 max-w-3xl">
        {reviews.items.slice(0, PREVIEW_COUNT).map((review, index) => (
          // Hai review mồi trồi lên nối nhau (nhóm motion 1, 19/08).
          <RevealItem key={review.id} enter="rise" delay={index * STAGGER.grid}>
            <ReviewCard review={review} />
          </RevealItem>
        ))}
      </div>

      <ReviewDialog
        slug={tour.slug}
        tourTitle={tour.title}
        open={open}
        onOpenChange={setOpen}
        initialPage={reviews}
        ratingAvg={tour.ratingAvg}
      />
    </div>
  );
}
