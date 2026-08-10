import { BookingCodeSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AccountRow,
  AccountRows,
  AccountSection,
  AccountSections,
} from '@/components/account/account-section';
import { BookingActions } from '@/components/account/booking-actions';
import { ReviewForm } from '@/components/account/review-form';
import { fetchBookingByCode } from '@/lib/api/bookings';
import { requireSession } from '@/lib/api/session';
import { bookingView, toCancellationView } from '@/lib/booking-vm';
import { reviewSlot } from '@/lib/review';
import { formatDateRange, formatMoney } from '@/lib/tours';

/** Nhãn provider hiển thị — TÁI DÙNG nguyên copy đã có ở `booking.form`
 *  (trang checkout chọn provider), không thêm key i18n mới cho hai tên
 *  thương hiệu cố định. */
const PROVIDER_LABEL = {
  STRIPE: messages.booking.form.stripe,
  PAYPAL: messages.booking.form.paypal,
} as const;

/**
 * Tìm booking theo mã (Task 6/A2: `bookings.byCode` thật thay mock). Mã
 * KHÔNG khớp shape `BookingCodeSchema` (link cũ/gõ tay/bot) → `null` NGAY,
 * khỏi tốn round-trip API cho một input chắc chắn không tồn tại — cùng nhánh
 * `notFound()` với mã hợp lệ nhưng không phải của mình/không tồn tại
 * (`NOT_FOUND` owner-or-404 từ `fetchBookingByCode`, xem `bookings.ts`).
 */
async function findBooking(cookie: string, code: string) {
  if (!BookingCodeSchema.safeParse(code).success) return null;
  return fetchBookingByCode(cookie, code);
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  // `generateMetadata` có thể chạy TRƯỚC guard session của thân trang (Next
  // không đảm bảo thứ tự) — không gate ở đây, chỉ đọc THỬ để có tiêu đề đẹp;
  // thân trang vẫn là nơi quyết định 404/redirect thật. `try/catch` best-effort:
  // một lỗi hiếm (session hết hạn giữa proxy và đây, mạng chập chờn…) chỉ rớt
  // về tiêu đề chung, KHÔNG được làm sập cả trang — đó là việc của thân trang.
  const cookie = (await cookies()).toString();
  let booking: Awaited<ReturnType<typeof findBooking>> = null;
  try {
    booking = await findBooking(cookie, code);
  } catch {
    booking = null;
  }
  if (!booking) return { title: 'Booking not found — Tourism' };
  return {
    title: `${booking.tourTitle} — ${messages.accountBookingDetail.tourLabel} ${booking.code} — Tourism`,
    robots: { index: false },
  };
}

export default async function AccountBookingDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  await requireSession(`/account/bookings/${code}`);
  const cookie = (await cookies()).toString();
  const booking = await findBooking(cookie, code);
  if (!booking) notFound();

  const t = messages.accountBookingDetail;
  const rv = messages.reviews;
  // Soi gương luật của API — xem JSDoc `reviewSlot`.
  const slot = reviewSlot(booking);
  const cancellation = toCancellationView(booking.cancellationStatus);
  const view = bookingView(booking, cancellation);
  // `terminalNote` chỉ có key cho 3 status không mang action nào — tra bảng
  // bằng `statusKey` của VM (giống cách badge dashboard đọc `booking.list.
  // status[...]`), KHÔNG if/else riêng theo từng status ở đây.
  const terminalNote = t.terminalNote[view.statusKey];

  const sec = t.sections;

  return (
    <div>
      {/* Hero A (Task 7): ảnh ngang KHI có `tourImage` — null thì BỎ HẲN,
          không giữ chỗ (khác `TripCard` giữa danh sách nhiều thẻ cần cao bằng
          nhau; ở đây chỉ một trang, một thẻ, không có hàng để so lệch). */}
      {booking.tourImage ? (
        // `<img>` thường, KHÔNG `next/image`: `next.config.ts` chưa khai
        // `images.remotePatterns` cho host media thật — tiền lệ
        // `trip-card.tsx`/`checkout-summary.tsx`.
        // biome-ignore lint/performance/noImgElement: lý do ở comment trên.
        <img
          src={booking.tourImage.url}
          alt={booking.tourImage.alt ?? ''}
          className="mb-4 aspect-[21/9] w-full rounded-2xl object-cover"
        />
      ) : null}
      {/* Back-link đứng TRÊN H1 như breadcrumb của Airbnb: nó nói "bạn đang ở
          trong Trips", tức thuộc về thanh điều hướng chứ không thuộc về nội
          dung trang. */}
      <Link
        href="/account/bookings"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
        {t.back}
      </Link>
      {/* H1 + link "View tour" sang trang tour công khai — cùng hàng, link
          nhỏ hơn và nhạt hơn để H1 vẫn là thứ mắt đọc trước. */}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-heading text-2xl font-medium text-balance text-foreground">
          {booking.tourTitle}
        </h1>
        <Link
          href={`/tours/${booking.tourSlug}`}
          className="inline-flex items-center gap-1 text-sm text-primary-emphasis underline-offset-4 hover:underline"
        >
          {t.viewTour}
          <ArrowRightIcon className="size-3.5" aria-hidden="true" />
        </Link>
      </div>
      {/* Mã + trạng thái thành MỘT dòng mono dưới tiêu đề, thay pill
          `TONE_CLASS` — pill dùng `bg-warning/10 text-warning`, mà `warning`
          trên nền ở chế độ sáng đo 1.90:1. */}
      <p className="mt-2 font-mono text-xs tracking-[0.16em] text-muted-foreground uppercase">
        {booking.code}
        {' · '}
        {messages.booking.list.status[booking.status]}
      </p>

      <div className="mt-2">
        <AccountSections>
          <AccountSection title={sec.bookingHeading} description={sec.bookingBlurb}>
            <AccountRows>
              <AccountRow label={t.departureLabel}>
                <span className="text-foreground tabular-nums">
                  {formatDateRange(booking.departureStartDate, booking.departureEndDate)}
                </span>
              </AccountRow>
              <AccountRow label={t.travellersLabel}>
                <span className="text-foreground tabular-nums">
                  {messages.accountBookings.travellers(booking.numAdults, booking.numChildren)}
                </span>
              </AccountRow>
              <AccountRow label={t.refLabel}>
                <span className="font-mono text-foreground">{booking.code}</span>
              </AccountRow>
              <AccountRow label={t.paymentLabel}>
                <span className="text-foreground">{PROVIDER_LABEL[booking.paymentProvider]}</span>
              </AccountRow>
              {/* Dòng TỔNG đóng danh sách — cùng khuôn dòng, chỉ đậm hơn. */}
              <AccountRow label={<span className="font-medium">{t.totalLabel}</span>}>
                <span className="font-medium text-foreground tabular-nums">
                  {formatMoney(booking.totalAmount, booking.currency)}
                </span>
              </AccountRow>
            </AccountRows>
          </AccountSection>

          <AccountSection title={sec.contactHeading} description={sec.contactBlurb}>
            <AccountRows>
              <AccountRow label={t.contactLabel} sub={booking.contactName}>
                <span className="block text-muted-foreground">{booking.contactEmail}</span>
                {booking.contactPhone ? (
                  <span className="mt-0.5 block text-muted-foreground tabular-nums">
                    {booking.contactPhone}
                  </span>
                ) : null}
              </AccountRow>
              {booking.specialRequests ? (
                <AccountRow label={t.requestsLabel} sub={booking.specialRequests} />
              ) : null}
            </AccountRows>
          </AccountSection>

          <AccountSection title={sec.actionsHeading} description={sec.actionsBlurb}>
            {terminalNote ? (
              <p className="mb-4 text-sm text-muted-foreground">{terminalNote}</p>
            ) : null}
            {/* Link chính sách hủy KHÔNG còn ở đây — Task 7 chuyển nó vào
                trong `BookingActions`, đứng NGAY CẠNH text-link hủy (chuẩn
                Booking.com: policy gắn vào đúng hành động, không làm footer
                chung chung tách rời ngữ cảnh). */}
            <BookingActions
              view={view}
              // Task 7 (A2): `code` — KHÔNG `onAction` (Server Component không
              // truyền được hàm client thật qua RSC boundary, xem JSDoc
              // `BookingActions`); component tự dựng handler thật từ mã này.
              code={booking.code}
            />
          </AccountSection>

          {/* Cụm B nửa 2. Đặt SAU khối thông tin booking có chủ đích: câu hỏi
              đầu tiên khi mở trang này gần như luôn là "tiền của tôi đâu", nên
              lời mời đánh giá không được chen lên trước nó. */}
          {slot === 'hidden' ? null : (
            // `id="review"` — đích anchor `/account/bookings/{code}#review`
            // mà dòng "past" của `TripCard` đã trỏ tới từ Task 6.
            <AccountSection id="review" title={sec.reviewHeading} description={sec.reviewBlurb}>
              {slot === 'form' ? (
                <ReviewForm bookingCode={booking.code} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {slot === 'done' ? rv.alreadyReviewedBody : rv.tooEarlyBody}
                </p>
              )}
            </AccountSection>
          )}
        </AccountSections>
      </div>
    </div>
  );
}
