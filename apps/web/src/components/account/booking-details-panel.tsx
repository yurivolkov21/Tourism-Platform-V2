import type { BookingDetail, BookingPhase } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { ButtonLink } from '@tourism/ui/components/button-link';
import { cn } from '@tourism/ui/lib/utils';
import { CalendarClockIcon, MessageSquareIcon, TicketIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { BookingActions, type CancelDialogBooking } from '@/components/account/booking-actions';
import {
  type BookingView,
  bookingTotalLabel,
  cancellationDeadlineText,
  legacyCancellationNote,
  paymentProviderLabel,
} from '@/lib/booking-vm';
import { bookingPriceLines, formatBookingMoney } from '@/lib/checkout';
import { formatDate, formatMoneyExact } from '@/lib/tours';

/** Giai đoạn có voucher để xem: đơn đã trả và còn hiệu lực (spec §5.3). */
const VOUCHER_PHASES: ReadonlySet<BookingPhase> = new Set(['upcoming', 'on_tour', 'travelled']);

/**
 * Cột trái trang chi tiết đơn (spec P7 §5.3, bản vẽ `.pn`): bốn khối Lead traveller · Payment ·
 * Cancellation · Details, rồi hàng nút đáy.
 *
 * Hàng đáy: trái là "Cancel booking" khi `bookingView` cho phép — mở ĐÚNG hộp huỷ sẵn có của
 * `BookingActions`, hộp in và gửi kèm số tiền server tính (`bookings.byCode.cancellation`);
 * không huỷ được thì câu "Questions about this trip?". Phải là "Contact us" và, ở ba giai đoạn
 * đã trả còn hiệu lực, "View voucher". Đơn chờ trả không lặp nút trả tiền ở đây — nó ở cột phải.
 *
 * Khối Cancellation giữ icon lịch và tông cảnh báo khi đã qua hạn: hạn chót là thông tin TIỀN,
 * bản dòng xám cỡ nhỏ từng bị khách bỏ qua (góp ý user 17/09).
 */
export function BookingDetailsPanel({
  booking,
  view,
  phase,
  meetingPoint,
}: {
  booking: BookingDetail;
  view: BookingView;
  phase: BookingPhase;
  meetingPoint: string | null;
}) {
  const t = messages.bookingDetail;
  const refunded = Number(booking.refundedTotal) > 0;
  const deadlineText = cancellationDeadlineText(booking.cancellation);
  const legacyNote = legacyCancellationNote(booking);
  const showCancellation = phase !== 'cancelled' && (deadlineText !== null || legacyNote !== null);
  const canCancel = view.actions.includes('cancelBooking');

  return (
    <div data-slot="booking-details" className="rounded-2xl border border-border bg-card">
      <Block title={t.leadTraveller}>
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-full bg-muted font-bold text-ink"
          >
            {initials(booking.contactName)}
          </span>
          <div className="min-w-0">
            <p className="font-semibold">{booking.contactName}</p>
            <p className="truncate text-[12.5px] text-muted-foreground">{booking.contactEmail}</p>
            {booking.contactPhone ? (
              <p className="text-[12.5px] text-muted-foreground">{booking.contactPhone}</p>
            ) : null}
          </div>
        </div>
      </Block>

      <Block title={messages.booking.success.paymentLabel}>
        <dl>
          {bookingPriceLines(booking).map((line) => (
            <Row key={line.label} label={line.label} value={line.amount} mono />
          ))}
          <Row
            total
            mono
            label={bookingTotalLabel(booking)}
            value={formatBookingMoney(booking, booking.totalAmount)}
          />
          {refunded ? (
            <Row
              mono
              label={t.details.refunded}
              // Số tiền THẬT đã hoàn — đủ hai số lẻ, như mọi chỗ in tiền hoàn của repo.
              value={t.details.refundedAmount(
                formatMoneyExact(booking.refundedTotal, booking.currency),
              )}
            />
          ) : null}
        </dl>
        {booking.paidAt ? (
          <p className="mt-1.5 text-[12.5px] text-muted-foreground">
            {t.details.paidInFull(
              paymentProviderLabel(booking.paymentProvider),
              formatDate(booking.paidAt.slice(0, 10)),
            )}
            {' · '}
            {messages.tourDetail.booking.testMode}
          </p>
        ) : null}
      </Block>

      {showCancellation ? (
        <Block title={t.details.cancellation}>
          {deadlineText ? (
            <p className="flex items-start gap-2 text-[13.5px]">
              <CalendarClockIcon
                aria-hidden="true"
                className={cn(
                  'mt-0.5 size-4 shrink-0',
                  booking.cancellation?.withinDeadline
                    ? 'text-primary-emphasis'
                    : 'text-warning-foreground',
                )}
              />
              <span>{deadlineText}</span>
            </p>
          ) : null}
          {legacyNote ? (
            <p className="mt-1.5 text-[12.5px] text-muted-foreground">{legacyNote}</p>
          ) : null}
        </Block>
      ) : null}

      <Block title={t.details.heading} last>
        <dl>
          {meetingPoint ? <Row label={t.details.meetingPoint} value={meetingPoint} /> : null}
          <Row
            label={t.details.specialRequests}
            value={booking.specialRequests ?? t.details.none}
            muted={booking.specialRequests === null}
          />
          <Row label={t.booked} value={formatDate(booking.createdAt.slice(0, 10))} />
        </dl>
      </Block>

      <div className="flex flex-wrap items-center justify-between gap-2.5 rounded-b-[15px] bg-muted/55 px-6 py-3 sm:px-[26px]">
        {canCancel ? (
          <BookingActions
            // Hàng đáy chỉ mang nút huỷ đơn đã trả; các hành động khác ở cột phải.
            view={{ ...view, actions: ['cancelBooking'] }}
            code={booking.code}
            booking={cancelDialogBooking(booking)}
          />
        ) : (
          <p className="text-[12.5px] text-muted-foreground">{t.details.questions}</p>
        )}
        {/* `ml-auto`: nút huỷ kèm link chính sách của `BookingActions` dài hơn nửa cột, hàng
            xuống dòng — cụm nút vẫn bám mép PHẢI như spec §5.3 thay vì dạt về trái. */}
        <div className="ml-auto flex flex-wrap gap-2">
          <ButtonLink href="/contact" variant="outline" size="sm">
            <MessageSquareIcon aria-hidden="true" />
            {messages.passportVisa.contactUs}
          </ButtonLink>
          {VOUCHER_PHASES.has(phase) ? (
            <ButtonLink href={`/checkout/success?code=${booking.code}`} size="sm">
              <TicketIcon aria-hidden="true" />
              {messages.passportVisa.viewVoucher}
            </ButtonLink>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Chữ cái đầu của từ ĐẦU và từ CUỐI tên — "Erik Lund" → "EL", "Nguyễn Văn An" → "NA". */
function initials(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((word) => word !== '');
  const first = words[0]?.charAt(0) ?? '';
  const last = words.length > 1 ? (words.at(-1)?.charAt(0) ?? '') : '';
  return `${first}${last}`.toUpperCase();
}

/** Phần đơn mà hộp xác nhận huỷ cần — cắt đúng chừng này như trang cũ đã làm. */
function cancelDialogBooking(booking: BookingDetail): CancelDialogBooking {
  return {
    code: booking.code,
    tourTitle: booking.tourTitle,
    tourSlug: booking.tourSlug,
    departureStartDate: booking.departureStartDate,
    departureEndDate: booking.departureEndDate,
    numAdults: booking.numAdults,
    numChildren: booking.numChildren,
    currency: booking.currency,
    cancellation: booking.cancellation,
  };
}

function Block({
  title,
  last = false,
  children,
}: {
  title: string;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={cn('px-6 py-4 sm:px-[26px]', last ? null : 'border-b border-muted')}>
      <h2 className="mb-2.5 text-[10px] leading-none font-bold tracking-[0.15em] text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Row({
  label,
  value,
  mono = false,
  total = false,
  muted = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  total?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex justify-between gap-4 py-[3px] text-[13.5px]',
        total && 'mt-1.5 border-t border-muted pt-2 font-bold',
      )}
    >
      <dt className={cn('shrink-0', total ? null : 'text-muted-foreground')}>{label}</dt>
      <dd
        className={cn(
          'text-right',
          mono && 'font-mono tabular-nums',
          muted && 'text-muted-foreground',
        )}
      >
        {value}
      </dd>
    </div>
  );
}
