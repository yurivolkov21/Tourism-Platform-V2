import { messages } from '@tourism/i18n';
import { Avatar, AvatarFallback } from '@tourism/ui/components/avatar';
import { StarIcon, UserIcon } from 'lucide-react';
import Link from 'next/link';
import { SectionEyebrow } from '@/components/home/section-eyebrow';
import { RevealHeading, RevealLede } from '@/components/motion/reveal-header';
import { RevealItem } from '@/components/motion/reveal-item';
import { STAGGER } from '@/lib/motion';
import type { RegionReview } from '@/lib/regions';
import { formatReviewDate } from '@/lib/tours';

/** Số review ở lại trên trang. Ba là đủ để nghe được giọng của vùng mà không biến
    khu cuối trang thành một danh sách dài — cùng con số `TourReviews` đã chọn cho
    phần inline của trang tour. */
const INLINE_COUNT = 3;

/**
 * Khu "Khách nói gì" — CHỈ miền Nam dựng, và nó là khu CUỐI của trang đó.
 *
 * Vì sao là khu riêng của Nam: Nam mỏng dữ liệu nhất trong ba vùng (chuyến riêng
 * 1–3 ngày, độ khó dừng ở Moderate, một tour `difficulty: null`), nên mọi khu
 * "hình hoá dữ liệu" nghĩ ra cho nó đều phải bịa. Lời người đã đi thì có THẬT: 25
 * review thuộc vùng này (số đo trên fixture test, không phải seed thật). Đây là
 * ngôn ngữ khách du lịch đúng nghĩa nhất trong sáu khu riêng — không phải mô tả
 * của người bán, mà là câu của người đã đi.
 *
 * ⚠️ KHÔNG có điểm trung bình và KHÔNG có histogram phân bố sao, cùng lý do
 * `TourReviews` đã ghi: `PublicReviewSchema` không có số đếm theo từng mức, nên
 * tính từ ba review đang hiện là nói dối. Ngoài ra một biểu đồ ở đây chính là thứ
 * user vừa bác ở vòng thiết kế thứ ba.
 *
 * **Nền TRANG, không phải băng phớt.** Đây là khu cuối trang. (Lịch sử: thời
 * footer còn `mt-32`, khu cuối nền riêng sẽ lộ 128px vạch sáng — margin đó đã
 * GỠ 12/08 nên ràng buộc "phải nền trang" không còn là bắt buộc kỹ thuật,
 * giữ vì đang đẹp.)
 *
 * NGÔN NGỮ HÌNH mượn nguyên của `tours/tour-reviews.tsx` (xoá 13/08; bản còn
 * sống là `tours/review-card.tsx`) — cùng bộ sao
 * `fill-rating`/`text-rating-muted`, cùng `Avatar`/`AvatarFallback`, cùng
 * `formatReviewDate`, cùng cách xử `authorDeleted`. Phát minh kiểu thứ hai cho
 * review là để hai chỗ trong site nói cùng một thứ bằng hai giọng.
 *
 * `reviews` phải vào ĐÃ SẮP mới-nhất-trước (`reviewsInRegion()` làm việc đó). Khu
 * này chỉ CẮT ba mục đầu, không sắp lại: hai nguồn cho cùng một thứ tự rồi sẽ
 * lệch nhau im lặng.
 */
export function RegionReviews({
  regionName,
  reviews,
}: {
  regionName: string;
  reviews: readonly RegionReview[];
}) {
  const t = messages.regionPage.reviews;
  const shared = messages.tourDetail.reviews;

  // Vùng chưa có review nào là nhánh CÓ THẬT khi gắn API (catalogue mới, chưa ai
  // đi). Khi đó bỏ hẳn khu: một tiêu đề "What travellers say" trên khoảng trống
  // đọc thành "chưa ai nói gì tốt về nơi này".
  if (reviews.length === 0) return null;

  return (
    <section className="w-full px-4 py-16 md:px-16 md:py-20 lg:px-24 xl:px-32">
      <div className="mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <SectionEyebrow>{t.eyebrow}</SectionEyebrow>
          {/* Cascade header (Task 5m) — xem `motion/reveal-header.tsx`. */}
          <RevealHeading className="mt-4 font-heading text-3xl leading-tight font-medium text-balance text-foreground md:text-[40px]/12">
            {t.heading(regionName)}
          </RevealHeading>
          <RevealLede className="mt-2 text-lg text-pretty text-muted-foreground">
            {t.subtitle}
          </RevealLede>
        </div>

        {/* Ba cột ở `lg`, một cột dưới đó. Vạch trên mỗi cột (`border-t`) là thứ
            ĐỊNH DANH thẻ, không phải một mảng nền: đo được ở đợt trước là không
            token bề mặt nào của bảng màu này tách nổi 3:1 khỏi nền, nên một thẻ
            tô nền chỉ đọc ra "hơi khác" chứ không ra "một tấm riêng". Vạch mảnh
            cộng khoảng cách thì đọc được ở cả hai theme. */}
        <ul className="mt-12 grid gap-x-10 gap-y-10 sm:mt-14 lg:grid-cols-3">
          {reviews.slice(0, INLINE_COUNT).map(({ review, tourSlug, tourTitle }, i) => {
            const name = review.authorName ?? shared.deletedAuthor;
            return (
              <li key={review.id} data-review={review.id}>
                {/* ── Chữ ký miền NAM: NỞ RA tại chỗ, không trục (Task 5n) ──
                    Cùng nhịp với dải bưu thiếp mở đầu trang Nam, nên hai đầu trang
                    khép lại thành một chữ ký.
                    ⚠️ CỐ Ý **không** thêm phản hồi hover cho thẻ review, dù chữ ký
                    của miền Nam là "chạm": thẻ này KHÔNG bấm được (chỉ dòng ghi công
                    tour bên trong là link), nên một thẻ nhô lên khi trỏ chuột là hứa
                    một cú bấm không tồn tại. Chỗ chữ ký chạm được nói thật là dải bưu
                    thiếp (ảnh trang trí, xoè cả dải) và ô gallery (vốn là `<button>`
                    mở lightbox, đã có zoom hover từ trước). */}
                <RevealItem
                  enter="bloom"
                  delay={i * STAGGER.grid}
                  className="border-t border-border pt-6"
                >
                  <article>
                    {/* `role="img"` + `aria-label` mang con số: năm icon rời rạc
                      không đọc thành "4 trên 5" được. Cùng khuôn `TourReviews`. */}
                    <span
                      role="img"
                      aria-label={shared.ratingLabel(review.rating)}
                      className="flex items-center gap-0.5"
                    >
                      {[1, 2, 3, 4, 5].map((step) => (
                        <StarIcon
                          key={step}
                          aria-hidden="true"
                          className={
                            step <= review.rating
                              ? 'size-4 fill-rating text-rating'
                              : 'size-4 text-rating-muted'
                          }
                        />
                      ))}
                    </span>

                    {/* `title` nullable và mock CÓ null thật — bỏ hẳn thẻ tiêu đề,
                      không in chuỗi rỗng hay chữ thay thế bịa ra. */}
                    {review.title ? (
                      <h3 className="mt-3 font-heading text-xl font-medium text-balance text-foreground">
                        {review.title}
                      </h3>
                    ) : null}
                    <p className="mt-2 text-pretty text-muted-foreground">{review.body}</p>

                    {/* Ảnh khách tự đính kèm khi viết review (ADR-0021) — công khai
                        vì review đã qua duyệt. Cùng khuôn strip của `TourReviews`. */}
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

                    <div className="mt-5 flex items-start gap-3">
                      <Avatar className="size-9 shrink-0">
                        <AvatarFallback>
                          {/* Tài khoản đã xoá không có chữ cái nào để lấy — icon
                            người trung tính thay vì một chữ cái bịa hay dấu "?". */}
                          {review.authorName ? (
                            review.authorName.charAt(0)
                          ) : (
                            <UserIcon className="size-4" aria-hidden="true" />
                          )}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <span
                          className={
                            review.authorDeleted
                              ? 'block text-sm text-muted-foreground italic'
                              : 'block text-sm font-medium text-foreground'
                          }
                        >
                          {name}
                        </span>
                        <span className="font-mono text-xs text-muted-foreground">
                          {formatReviewDate(review.createdAt)}
                        </span>
                        {/* Ghi công tour — thứ giữ khu này khỏi nói sai. Review của
                          tour XUYÊN VÙNG cũng thuộc miền Nam (lưới 6 tour của
                          trang cũng có nó), và dòng này cho người đọc thấy ngay
                          review nói về chuyến nào. */}
                        <Link
                          href={`/tours/${tourSlug}`}
                          className="mt-0.5 block text-sm text-muted-foreground underline decoration-border underline-offset-4 transition-colors hover:text-primary-emphasis hover:decoration-primary"
                        >
                          {t.onTrip(tourTitle)}
                        </Link>
                      </div>
                    </div>
                  </article>
                </RevealItem>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
