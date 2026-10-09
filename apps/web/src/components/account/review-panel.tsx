import type { BookingDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import Link from 'next/link';
import { RetractReviewButton } from '@/components/account/retract-review-button';
import { ReviewComposer } from '@/components/account/review-composer';
import type { ReviewAreaSlot } from '@/lib/review';

/**
 * Khu review của trang chi tiết đơn (spec P7 §2.5): khu review cũ — CHỈ đổi chỗ, giữ nguyên
 * linh kiện, chữ và luật `reviewSlot` (spec §5.4). `id="review"` là đích của link "Review →" ở
 * `BookingAccordion`.
 *
 * Có mặt theo CỔNG review của API (`hasReviewArea`), ở mọi giai đoạn, xếp dưới khối của giai
 * đoạn ấy (ADR-0054 AMEND 1 §5): ngày về từ 07:00 giờ VN dưới "Today's plan", đơn đã có review
 * rồi bị hoàn hay huỷ dưới khối đóng. `slot` do trang tính MỘT lần rồi đưa xuống.
 */
export function ReviewPanel({ booking, slot }: { booking: BookingDetail; slot: ReviewAreaSlot }) {
  const sec = messages.accountBookingDetail.sections;
  return (
    // Khung thẻ ở MỌI khổ như các khối anh em: hàng sao + nút gửi của `ReviewForm` xuống dòng được
    // nên composer vừa cột 320px trong khung (review P7 B12 — bản trước bỏ khung dưới `sm` vì hàng
    // ấy không co được, mà slot pending vẫn làm cả trang cuộn ngang 26px ở 375px).
    <section
      id="review"
      aria-labelledby="review-heading"
      className="rounded-2xl border border-border bg-card px-6 py-5 sm:px-[26px]"
    >
      <h2 id="review-heading" className="font-heading text-[19px] leading-tight font-semibold">
        {sec.reviewHeading}
      </h2>
      <p className="mt-0.5 text-[13px] text-muted-foreground">{sec.reviewBlurb}</p>
      <div className="mt-3">
        {/* Trạng thái NÓI TRƯỚC, form đứng sau (ADR-0032 §7). */}
        <ReviewSlotNote slot={slot} reason={booking.review?.moderationNote ?? null} />
        {/* W4 U2 (ADR-0032 AMEND 1): review ĐANG đăng có đường rút. */}
        {slot === 'approved' && booking.review ? (
          <div className="mt-2">
            <RetractReviewButton reviewId={booking.review.id} />
          </div>
        ) : null}
        {slot === 'form' || slot === 'pending' || slot === 'rejected' ? (
          <ReviewComposer bookingCode={booking.code} review={booking.review ?? undefined} />
        ) : null}
      </div>
    </section>
  );
}

/**
 * Cột phải của chuyến đã đi mà không có khu review (slot `hidden` — vd đơn hoàn một phần): lời
 * cảm ơn và "Browse tours" — một cột trống là một trang trông như hỏng.
 */
export function TripThanksPanel() {
  return (
    <section
      aria-labelledby="trip-thanks-heading"
      className="rounded-2xl border border-border bg-card px-6 py-5"
    >
      <h2 id="trip-thanks-heading" className="font-heading text-[19px] leading-tight font-semibold">
        {messages.bookingDetail.closed.thanks}
      </h2>
      <ButtonLink href="/tours" variant="outline" className="mt-4">
        {messages.booking.list.browse}
      </ButtonLink>
    </section>
  );
}

/**
 * Câu nói trạng thái của chỗ đánh giá — mỗi slot một câu, không ternary lồng
 * nhau trong JSX.
 *
 * `rejected` và `rejectedFinal` cùng in LÝ DO nhưng khác hẳn câu sau đó: một
 * bên mời viết lại, một bên nói thẳng đã hết đường và mở lối liên hệ. Gộp
 * chúng là để khách bấm vào một form không còn ở đó.
 */
function ReviewSlotNote({ slot, reason }: { slot: ReviewAreaSlot; reason: string | null }) {
  const rv = messages.reviews;
  if (slot === 'form') return null;

  if (slot === 'approved') {
    return <SlotNote title={rv.alreadyReviewedTitle} body={rv.alreadyReviewedBody} />;
  }
  if (slot === 'retracted') {
    // W4 U2: kết cục đóng — nói rõ, không mời làm gì thêm.
    return <SlotNote title={rv.retractedTitle} body={rv.retractedBody} />;
  }
  if (slot === 'pending') {
    return <SlotNote title={rv.pendingTitle} body={rv.pendingBody} />;
  }

  const final = slot === 'rejectedFinal';
  return (
    <div className="mb-4 flex flex-col gap-2">
      <SlotNote
        title={final ? rv.rejectedFinalTitle : rv.rejectedTitle}
        body={final ? rv.rejectedFinalBody : rv.rejectedBody}
      />
      {/* Nguyên văn lý do người duyệt viết — ĐÚNG câu khách đã nhận qua mail,
          nên hai nguồn không thể nói khác nhau. Chữ tự do: link dán liền bẻ ở bất kỳ đâu, không
          đẩy trang cuộn ngang (cùng lỗi review P7 S2). */}
      {reason ? (
        <figure className="rounded-md border border-border/60 bg-muted/40 p-3">
          <figcaption className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {rv.rejectedReason}
          </figcaption>
          <blockquote className="mt-1 text-sm whitespace-pre-wrap [overflow-wrap:anywhere]">
            {reason}
          </blockquote>
        </figure>
      ) : null}
      {final ? (
        <Link href="/contact" className="w-fit text-sm underline-offset-4 hover:underline">
          {messages.nav.contact}
        </Link>
      ) : null}
    </div>
  );
}

function SlotNote({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{body}</p>
    </div>
  );
}
