import { BookingCodeSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { ArrowLeftIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BookingActions } from '@/components/account/booking-actions';
import { fetchBookingByCode } from '@/lib/api/bookings';
import { requireSession } from '@/lib/api/session';
import { TONE_CLASS } from '@/lib/booking-tone';
import { bookingView, toCancellationView } from '@/lib/booking-vm';
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
  const cancellation = toCancellationView(booking.cancellationStatus);
  const view = bookingView(booking, cancellation);
  // `terminalNote` chỉ có key cho 3 status không mang action nào — tra bảng
  // bằng `statusKey` của VM (giống cách badge dashboard đọc `booking.list.
  // status[...]`), KHÔNG if/else riêng theo từng status ở đây.
  const terminalNote = t.terminalNote[view.statusKey];

  return (
    <div className="flex flex-col gap-8">
      <Link
        href="/account/bookings"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeftIcon className="size-3.5" aria-hidden="true" />
        {t.back}
      </Link>

      <div>
        <div className="flex items-center gap-2.5">
          <span
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASS[view.tone]}`}
          >
            {messages.booking.list.status[booking.status]}
          </span>
          <span className="font-mono text-xs text-muted-foreground">{booking.code}</span>
        </div>
        <h1 className="mt-2 font-heading text-2xl font-medium text-balance text-foreground">
          {booking.tourTitle}
        </h1>
      </div>

      <dl className="grid gap-6 rounded-2xl border bg-card p-6 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-muted-foreground">{t.departureLabel}</dt>
          <dd className="mt-1 text-foreground">
            {formatDateRange(booking.departureStartDate, booking.departureEndDate)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{t.travellersLabel}</dt>
          <dd className="mt-1 text-foreground">
            {messages.accountBookings.travellers(booking.numAdults, booking.numChildren)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{t.refLabel}</dt>
          <dd className="mt-1 font-mono text-foreground">{booking.code}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{t.totalLabel}</dt>
          <dd className="mt-1 font-heading text-lg font-semibold tabular-nums text-foreground">
            {formatMoney(booking.totalAmount, booking.currency)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{t.paymentLabel}</dt>
          <dd className="mt-1 text-foreground">{PROVIDER_LABEL[booking.paymentProvider]}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted-foreground">{t.contactLabel}</dt>
          <dd className="mt-1 text-foreground">
            {booking.contactName}
            <br />
            <span className="text-muted-foreground">{booking.contactEmail}</span>
            {booking.contactPhone ? (
              <>
                <br />
                <span className="text-muted-foreground">{booking.contactPhone}</span>
              </>
            ) : null}
          </dd>
        </div>
        {booking.specialRequests ? (
          <div className="sm:col-span-2">
            <dt className="text-sm text-muted-foreground">{t.requestsLabel}</dt>
            <dd className="mt-1 text-pretty text-foreground">{booking.specialRequests}</dd>
          </div>
        ) : null}
      </dl>

      <div className="flex flex-col gap-3">
        <BookingActions
          view={view}
          deniedNote={cancellation?.status === 'DENIED' ? cancellation.decisionNote : null}
          // Task 7 (A2): `code` — KHÔNG `onAction` (Server Component không
          // truyền được hàm client thật qua RSC boundary, xem JSDoc
          // `BookingActions`); component tự dựng handler thật từ mã này.
          code={booking.code}
        />
        {terminalNote ? <p className="text-sm text-muted-foreground">{terminalNote}</p> : null}
        <Link href="/cancellation-policy" className="text-sm text-primary hover:underline">
          {t.policyLink}
        </Link>
      </div>

      {/* Chừa chỗ cụm B (form review thật gắn ở đây) — placeholder nhẹ, chỉ
          hiện copy tĩnh, không dựng logic/form. */}
      <section className="rounded-2xl border p-6">
        <h2 className="font-heading text-lg font-medium text-foreground">{t.review.heading}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t.review.body}</p>
      </section>
    </div>
  );
}
