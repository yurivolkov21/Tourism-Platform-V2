import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import { StarIcon } from 'lucide-react';
import type { TourReviewVM } from '@/lib/api/tours';
import { formatReviewDate } from '@/lib/tours';

/**
 * Cụm năm sao chỉ-đọc. `role="img"` + nhãn gộp: năm icon rời rạc không đọc
 * thành "4 trên 5" được. Cùng khuôn `region-reviews.tsx` — đừng đẻ kiểu thứ hai.
 */
export function StarRow({ rating, className }: { rating: number; className?: string }) {
  return (
    <span
      role="img"
      aria-label={messages.tourDetail.reviews.ratingLabel(rating)}
      // `inline-flex` + `h-5`: `.stars` của wireframe là `inline-block` cao 20
      // (14px/20). Để `flex` thì cụm sao chiếm trọn bề ngang cột và cao đúng
      // bằng icon — đo được 220×14 thay vì 68×20.
      className={cn('inline-flex h-5 items-center gap-0', className)}
    >
      {[1, 2, 3, 4, 5].map((step) => (
        <StarIcon
          key={step}
          aria-hidden="true"
          className={cn(
            'size-3.5',
            step <= rating ? 'fill-rating text-rating' : 'text-rating-muted',
          )}
        />
      ))}
    </span>
  );
}

/**
 * Một thẻ review — dựng bám `.rv-item` của wireframe (pad dọc 18, viền đáy 1px,
 * mục cuối bỏ viền).
 *
 * DÙNG CHUNG cho hai chỗ: hai review mồi trong tab và danh sách trong modal.
 * Tách ra vì bản trước dựng hai bản riêng rồi lệch nhau — modal có ảnh, tab thì
 * không, cùng một review đọc ra hai kiểu.
 *
 * ⚠️ KHÔNG có huy hiệu "Verified rider" dù bản duyệt có: `PublicReviewSchema`
 * không phơi `source`, và `listByTour` trả CẢ review `CURATED` (fixture tour
 * hiện 100% CURATED, không gắn booking nào). Gắn nhãn "verified" lên chúng là
 * khẳng định điều dữ liệu công khai không xác nhận được.
 */
export function ReviewCard({ review }: { review: TourReviewVM }) {
  const t = messages.tourDetail.reviewsTab;
  const name = review.authorDeleted ? t.deletedAccount : (review.authorName ?? t.deletedAccount);

  return (
    <article className="border-b border-border py-[18px] last:border-b-0">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden="true"
            className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs leading-none font-medium text-muted-foreground"
          >
            {review.authorDeleted ? '–' : name.charAt(0)}
          </span>
          <span
            className={cn(
              'truncate text-sm leading-5',
              review.authorDeleted ? 'text-muted-foreground italic' : 'font-medium text-foreground',
            )}
          >
            {name}
          </span>
        </div>
        <span className="shrink-0 text-xs leading-5 text-muted-foreground">
          {formatReviewDate(review.createdAt)}
        </span>
      </div>

      <StarRow rating={review.rating} className="mt-2" />

      {/* `title` nullable và fixture CÓ null thật — bỏ hẳn thẻ tiêu đề, không in
          chuỗi rỗng hay chữ thay thế bịa ra. */}
      {review.title ? (
        <p className="mt-2 font-heading text-[15px] leading-[22px] font-medium text-foreground">
          {review.title}
        </p>
      ) : null}
      <p className="mt-1 text-sm leading-[22px] text-foreground">{review.body}</p>

      {review.media.length > 0 ? (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {review.media.map((photo) => (
            // Ảnh khách tự đính kèm (ADR-0021). `<img>` thường chứ không
            // `next/image`: URL Cloudinary đã ký, kích cỡ cố định 64px, không
            // cần lớp tối ưu nào ở giữa.
            // biome-ignore lint/performance/noImgElement: ảnh 64px từ Cloudinary đã ký, không cần loader của Next
            <img
              key={photo.url}
              src={photo.url}
              alt={photo.alt ?? ''}
              className="size-16 rounded-sm border border-border object-cover"
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}
