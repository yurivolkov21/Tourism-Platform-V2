import { messages } from '@tourism/i18n';
import { Avatar, AvatarFallback } from '@tourism/ui/components/avatar';
import { Rating } from '@tourism/ui/components/reui/rating';
import { UserIcon } from 'lucide-react';
import Image from 'next/image';
import type { TourReviewVM } from '@/lib/api/tours';
import { formatReviewDate } from '@/lib/tours';

/**
 * Một review — dùng CHUNG bởi tab Reviews và modal "Show all reviews", nên hai
 * nơi không thể trôi ra hai kiểu trình bày khác nhau.
 *
 * KHÔNG có huy hiệu "Verified rider" dù bản wireframe có: `PublicReviewSchema`
 * không phơi `source`, và `listByTour` trả cả review `CURATED` (không gắn
 * booking nào — xem `fixtures/catalog/reviews.ts`). Dán nhãn "verified" lên
 * chúng là khẳng định điều dữ liệu công khai không xác nhận được.
 *
 * Ngày hiển thị theo `formatReviewDate` (tháng + năm) chứ không phải "2 weeks
 * ago" như wireframe: quy ước đó đã có sẵn trong repo kèm lý do (độ chính xác
 * tới ngày không giúp người đọc quyết định gì).
 */
export function ReviewCard({ review }: { review: TourReviewVM }) {
  const t = messages.tourDetail;
  const name = review.authorName ?? t.reviewsTab.deletedAccount;

  return (
    <article>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <Avatar className="size-8 shrink-0">
            <AvatarFallback className="text-xs">
              {/* Tài khoản đã xoá không còn chữ cái nào để lấy — icon người
                  trung tính thay vì một chữ bịa hay dấu "?". */}
              {review.authorName ? (
                review.authorName.charAt(0)
              ) : (
                <UserIcon className="size-3.5" aria-hidden="true" />
              )}
            </AvatarFallback>
          </Avatar>
          <span
            className={
              review.authorDeleted
                ? 'truncate text-sm leading-[20px] text-muted-foreground italic'
                : 'truncate text-sm leading-[20px] font-medium'
            }
          >
            {name}
          </span>
        </div>
        <span className="shrink-0 font-mono text-[11px] leading-[16px] text-muted-foreground">
          {formatReviewDate(review.createdAt)}
        </span>
      </div>

      <Rating
        rating={review.rating}
        size="sm"
        className="mt-2.5 gap-0"
        starClassName="size-3.5"
        aria-label={t.reviews.ratingLabel(review.rating)}
      />

      {review.title ? (
        <h4 className="mt-2.5 font-heading text-base leading-[22px] font-medium">{review.title}</h4>
      ) : null}
      <p className="mt-1.5 max-w-[68ch] text-sm leading-[22px] text-muted-foreground">
        {review.body}
      </p>

      {/* Ảnh khách tự đính kèm (ADR-0021) — công khai vì review đã qua duyệt.
          Dải thumbnail đơn giản, không lightbox: đây là bằng chứng đi kèm lời
          kể, không phải gallery cần phóng to. */}
      {review.media.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {review.media.map((m) => (
            <Image
              key={m.publicId}
              src={m.url}
              alt={m.alt ?? ''}
              width={64}
              height={64}
              className="size-16 rounded-lg border border-border object-cover"
            />
          ))}
        </div>
      ) : null}
    </article>
  );
}
