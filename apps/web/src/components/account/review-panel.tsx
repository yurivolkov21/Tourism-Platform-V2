import type { BookingDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import Link from 'next/link';
import { RetractReviewButton } from '@/components/account/retract-review-button';
import { ReviewComposer } from '@/components/account/review-composer';
import { type ReviewSlot, reviewSlot } from '@/lib/review';

/**
 * Cột phải của chuyến đã đi (spec P7 §2.5): khu review cũ của trang chi tiết — CHỈ đổi chỗ,
 * giữ nguyên linh kiện, chữ và luật `reviewSlot` (spec §5.4). `id="review"` là đích của link
 * "Review →" ở `BookingAccordion`.
 *
 * Slot `hidden` (đơn đã đi nhưng không viết review được, vd hoàn một phần) thay bằng lời cảm
 * ơn và "Browse tours" — một cột trống là một trang trông như hỏng.
 */
export function ReviewPanel({ booking }: { booking: BookingDetail }) {
  const slot = reviewSlot(booking);
  if (slot === 'hidden') {
    return (
      <section
        aria-labelledby="review-heading"
        className="rounded-2xl border border-border bg-card px-6 py-5"
      >
        <h2 id="review-heading" className="font-heading text-[19px] leading-tight font-semibold">
          {messages.bookingDetail.closed.thanks}
        </h2>
        <ButtonLink href="/tours" variant="outline" className="mt-4">
          {messages.booking.list.browse}
        </ButtonLink>
      </section>
    );
  }

  const sec = messages.accountBookingDetail.sections;
  return (
    <section
      id="review"
      aria-labelledby="review-heading"
      className="rounded-2xl border border-border bg-card px-6 py-5"
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
 * Câu nói trạng thái của chỗ đánh giá — mỗi slot một câu, không ternary lồng
 * nhau trong JSX.
 *
 * `rejected` và `rejectedFinal` cùng in LÝ DO nhưng khác hẳn câu sau đó: một
 * bên mời viết lại, một bên nói thẳng đã hết đường và mở lối liên hệ. Gộp
 * chúng là để khách bấm vào một form không còn ở đó.
 */
function ReviewSlotNote({ slot, reason }: { slot: ReviewSlot; reason: string | null }) {
  const rv = messages.reviews;
  if (slot === 'form') return null;

  if (slot === 'approved') {
    return <SlotNote title={rv.alreadyReviewedTitle} body={rv.alreadyReviewedBody} />;
  }
  if (slot === 'retracted') {
    // W4 U2: kết cục đóng — nói rõ, không mời làm gì thêm.
    return <SlotNote title={rv.retractedTitle} body={rv.retractedBody} />;
  }
  if (slot === 'tooEarly') {
    return <SlotNote title={rv.tooEarlyTitle} body={rv.tooEarlyBody} />;
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
          nên hai nguồn không thể nói khác nhau. */}
      {reason ? (
        <figure className="rounded-md border border-border/60 bg-muted/40 p-3">
          <figcaption className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {rv.rejectedReason}
          </figcaption>
          <blockquote className="mt-1 text-sm whitespace-pre-wrap">{reason}</blockquote>
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
