'use client';

import { messages } from '@tourism/i18n';
import { Avatar, AvatarFallback } from '@tourism/ui/components/avatar';
import { Button } from '@tourism/ui/components/button';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { Dialog, DialogClose, DialogContent, DialogTitle } from '@tourism/ui/components/dialog';
import { StarIcon, UserIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { PaginationBar } from '@/components/tours/pagination-bar';
import type { TourReviewVM } from '@/lib/api/tours';
import { paginate } from '@/lib/paginate';
import { formatReviewDate, tourReviews } from '@/lib/tours';

/**
 * Khu "Traveller reviews" của trang chi tiết tour.
 *
 * BỐN THỨ CỐ TÌNH KHÔNG CÓ, mỗi thứ vì contract công khai không đỡ được — và cả
 * bốn đều từng có key trong khối i18n port từ Nexora, nên ghi lại ở đây để lần sau
 * không ai port lại:
 *  1. **Histogram phân bố sao.** Không có số đếm theo từng mức. Tính từ trang đang
 *     tải là nói dối: nó phản ánh 5 review vừa lấy, không phải toàn bộ.
 *  2. **Badge "Verified traveller".** `source: VERIFIED|CURATED` chỉ tồn tại ở
 *     `AdminReviewSchema` — cố ý không phơi công khai.
 *  3. **Sắp xếp / lọc theo sao.** `ReviewsByTourQuerySchema` chỉ có page/pageSize/
 *     tourSlug. Thứ tự do server quyết, và `tourReviews()` sao y nó.
 *  4. **CTA viết review.** `create` cần auth + bookingCode, eligibility đòi booking
 *     PAID và chuyến đã kết thúc. Luồng booking chưa có trong web → nút đó là hứa
 *     thứ sản phẩm không giữ.
 *
 * Ba review mới nhất ở trên trang, phần còn lại vào dialog có phân trang — đóng
 * khoản parity "Review list + See all dialog" mà Nexora có và v2 chưa.
 */

/** Số review ở lại trên trang. Ba là đủ để thấy giọng điệu mà không đẩy khu
    "You might also like" xuống quá sâu. */
const INLINE_COUNT = 3;

/** Số review mỗi trang trong dialog. Năm vừa một khung dialog không phải cuộn dài. */
const DIALOG_PAGE_SIZE = 5;

export function TourReviews({
  reviews,
  ratingAvg,
}: {
  reviews: TourReviewVM[];
  /** Từ `tour.ratingAvg` — được DẪN XUẤT từ chính `reviews` (denormalize atomically
      lúc duyệt review, xem `ReviewsService.moderate` phía API), nên con số ở đây và
      độ dài danh sách không thể lệch nhau. */
  ratingAvg: number | null;
}) {
  const t = messages.tourDetail.reviews;
  const ordered = tourReviews(reviews);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);

  // Rỗng: mời hành động chứ không chỉ thông báo — nhưng mời HỎI, không mời viết
  // review (chưa có luồng). /contact là trang có thật.
  if (ordered.length === 0 || ratingAvg === null) {
    return (
      <div className="mt-6 rounded-2xl border border-dashed px-6 py-10 text-center">
        <p className="font-medium text-foreground">{t.emptyTitle}</p>
        <p className="mx-auto mt-2 max-w-prose text-pretty text-muted-foreground">{t.emptyBody}</p>
        <ButtonLink variant="outline" className="mt-6" href="/contact">
          {messages.tourDetail.booking.ask}
        </ButtonLink>
      </div>
    );
  }

  const paged = paginate(ordered, page, DIALOG_PAGE_SIZE);

  return (
    <div className="mt-6">
      {/* Tóm tắt: điểm trung bình lớn + số review. Cả hai đến từ cùng một nguồn với
          danh sách bên dưới nên chúng không thể nói khác nhau. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="flex items-center gap-1.5">
          <StarIcon className="size-5 shrink-0 fill-rating text-rating" aria-hidden="true" />
          <span className="font-heading text-2xl font-semibold text-foreground tabular-nums">
            {ratingAvg.toFixed(1)}
          </span>
        </span>
        <span className="text-sm text-muted-foreground">
          {t.summary(ratingAvg.toFixed(1), ordered.length)}
        </span>
      </div>

      <p className="mt-5 font-mono text-xs tracking-widest text-muted-foreground uppercase">
        {t.recentLabel}
      </p>

      <ul className="mt-3 divide-y divide-border border-t border-border">
        {ordered.slice(0, INLINE_COUNT).map((review) => (
          <li key={review.id} className="py-5">
            <ReviewBody review={review} />
          </li>
        ))}
      </ul>

      {/* Nút chỉ có lý do tồn tại khi còn review chưa ở trên trang — đúng luật đã
          áp cho "View all N photos" của gallery. */}
      {ordered.length > INLINE_COUNT ? (
        <div className="mt-4">
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            {t.seeAll(ordered.length)}
          </Button>
        </div>
      ) : null}

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          // Đóng rồi mở lại phải về trang 1: giữ trang cũ làm người đọc mở ra thấy
          // "trang 3" mà không nhớ vì sao.
          if (!next) setPage(1);
        }}
      >
        <DialogContent showCloseButton={false} className="w-full gap-4 sm:max-w-2xl">
          <div className="flex items-baseline justify-between gap-3">
            <DialogTitle className="font-heading text-lg font-medium">
              {t.dialogTitle(ordered.length)}
            </DialogTitle>
            <DialogClose
              render={
                <Button variant="ghost" size="icon-sm" aria-label={t.close}>
                  <XIcon />
                </Button>
              }
            />
          </div>

          {/* data-lenis-prevent: Lenis chặn wheel trên cả tài liệu nên lăn chuột
              trong vùng cuộn lồng lại cuộn TRANG CHÍNH. */}
          <div data-lenis-prevent className="max-h-[60vh] overflow-y-auto pr-1">
            <ul className="divide-y divide-border">
              {paged.items.map((review) => (
                <li key={review.id} className="py-4 first:pt-0">
                  <ReviewBody review={review} />
                </li>
              ))}
            </ul>
          </div>

          <PaginationBar
            page={paged.page}
            totalPages={paged.totalPages}
            total={ordered.length}
            pageSize={DIALOG_PAGE_SIZE}
            onChange={setPage}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReviewBody({ review }: { review: TourReviewVM }) {
  const t = messages.tourDetail.reviews;
  const name = review.authorName ?? t.deletedAuthor;

  return (
    <article className="flex gap-3.5">
      <Avatar className="mt-0.5 size-9 shrink-0">
        <AvatarFallback>
          {/* Tài khoản đã xoá không có chữ cái nào để lấy — icon người trung tính
              thay vì một chữ cái bịa hay dấu "?". */}
          {review.authorName ? (
            review.authorName.charAt(0)
          ) : (
            <UserIcon className="size-4" aria-hidden="true" />
          )}
        </AvatarFallback>
      </Avatar>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <span
            className={
              review.authorDeleted
                ? 'text-sm text-muted-foreground italic'
                : 'text-sm font-medium text-foreground'
            }
          >
            {name}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {formatReviewDate(review.createdAt)}
          </span>
        </div>

        {/* Sao: năm ngôi, tô đủ theo rating. `aria-label` mang con số vì năm icon
            rời rạc không đọc thành "4 trên 5" được.
            `role="img"` chứ không để nguyên <p>: role `paragraph` không đỡ
            `aria-label` và Biome chặn đúng lý — cùng lỗi `CategoryChips` từng gặp.
            `role="img"` cũng đúng ngữ nghĩa: đây là MỘT hình ảnh gồm năm ngôi sao,
            không phải năm phần tử rời. */}
        <span
          role="img"
          aria-label={t.ratingLabel(review.rating)}
          className="mt-1 flex items-center gap-0.5"
        >
          {[1, 2, 3, 4, 5].map((step) => (
            <StarIcon
              key={step}
              aria-hidden="true"
              className={
                step <= review.rating
                  ? 'size-3.5 fill-rating text-rating'
                  : 'size-3.5 text-rating-muted'
              }
            />
          ))}
        </span>

        {review.title ? <h4 className="mt-2 font-medium text-foreground">{review.title}</h4> : null}
        <p className="mt-1 max-w-[68ch] text-sm text-pretty text-muted-foreground">{review.body}</p>

        {/* Ảnh khách tự đính kèm khi viết review (ADR-0021) — công khai vì review
            đã qua duyệt. Strip thumbnail đơn giản, không lightbox: đây là bằng
            chứng đi kèm lời kể, không phải gallery cần phóng to. */}
        {review.media.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {review.media.map((m) => (
              // biome-ignore lint/performance/noImgElement: URL Cloudinary ngoài — next/image chưa khai remotePatterns (nợ ADR-0020).
              <img
                key={m.publicId}
                src={m.url}
                alt={m.alt ?? ''}
                loading="lazy"
                className="h-20 w-28 rounded-md border border-border object-cover"
              />
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}
