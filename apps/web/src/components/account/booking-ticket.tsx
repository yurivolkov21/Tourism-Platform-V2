import { type BookingDetail, type BookingPhase, calendarDaysBetween } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import { BusIcon } from 'lucide-react';
import Link from 'next/link';
import { TicketBarcode } from '@/components/checkout/ticket-barcode';
import { RevealItem } from '@/components/motion/reveal-item';
import { VisaStamp } from '@/components/passport/visa-stamp';
import { SlotImage } from '@/components/slot-image';
import {
  bookingPass,
  bookingTotalLabel,
  paymentProviderLabel,
  vietnamDay,
  wasCharged,
} from '@/lib/booking-vm';
import { formatBookingMoney } from '@/lib/checkout';
import { calendarDateParts, formatDate } from '@/lib/tours';

/** Nhãn nhỏ in hoa của vé — `.k` của bản vẽ (10px, đậm, giãn chữ 0.15em). */
const KICKER =
  'text-[10px] leading-none font-bold tracking-[0.15em] text-muted-foreground uppercase';

/**
 * Vé kiểu boarding pass đầu trang chi tiết đơn (spec P7 §5.2, bản vẽ `.tk`): ảnh tour · thân
 * vé · cuống vé.
 *
 * Bố cục: dưới `xl` xếp dọc (ảnh 16:9, thân, cuống; đường xé nằm ngang); từ `xl` ba phần
 * ngang `210px | 1fr | 262px`. Mốc `xl` chứ không `md`: nội dung thẳng mép với tiêu đề hero
 * (`xl:px-32`) chỉ còn 1024px ở khổ 1280, bớt ảnh và cuống thì thân vé ~550px — hẹp hơn nữa
 * là hàng DEPARTS → RETURNS gãy dòng.
 *
 * Vé KHÔNG được `overflow: hidden`: hai vết khuyết (CSS ở `globals.css`, móc
 * `data-slot="ticket-stub"`) đè lên viền, nằm ngoài hộp đệm của vé. Vì thế từng mảng màu sát
 * góc (ảnh, hai dải `bg-primary`, lưới ô) tự bo góc 15px = 16px của vé trừ viền 1px.
 *
 * Mã vạch và mộc theo `bookingPass` — cùng luật với voucher. Mã vạch (sắp đi, đang đi, đã trả)
 * nói "quét tôi ở điểm đón", in nó cho đơn chưa trả, đã huỷ hay chuyến đã xong là hứa một thứ
 * không có (cùng bất biến chống nói dối của `BookingReceipt`). Mộc theo giai đoạn, không theo
 * trạng thái đơn: đơn qua hạn chót mà chưa trả không còn "AWAITING PAYMENT", đơn trên chuyến công
 * ty huỷ không còn "CONFIRMED".
 */
export function BookingTicket({ booking, phase }: { booking: BookingDetail; phase: BookingPhase }) {
  const t = messages.bookingDetail;
  const photo = booking.tourImage;
  const days = calendarDaysBetween(booking.departureStartDate, booking.departureEndDate) + 1;
  const place = booking.tourDestinations[0]?.name;
  const route = place ? `${t.ticket.days(days)} · ${place}` : t.ticket.days(days);
  const pass = bookingPass(booking, phase);
  const facts = [
    { label: t.leadTraveller, value: booking.contactName },
    {
      label: messages.passportVisa.labels.travellers,
      value: messages.accountBookings.travellers(booking.numAdults, booking.numChildren),
    },
    // `createdAt` là ISO đầy đủ — `formatDate` chỉ nhận ngày lịch: đổi sang ngày lịch VN trước.
    { label: t.booked, value: formatDate(vietnamDay(booking.createdAt)) },
    {
      label: t.ticket.paidWith,
      // Tên cổng khi tiền đã đi một vòng (`wasCharged`) — kể cả đơn bị thu rồi hoàn tự động trước
      // khi kịp sang PAID (`paidAt` null): "Not paid" cạnh "Refunded −$147.00" của khối Payment
      // cùng trang là nói ngược (review P7 B1).
      value: wasCharged(booking) ? paymentProviderLabel(booking.paymentProvider) : t.ticket.notPaid,
    },
  ];

  return (
    <article
      data-slot="booking-ticket"
      className={cn(
        'grid rounded-2xl border border-border bg-card',
        photo ? 'xl:grid-cols-[210px_minmax(0,1fr)_262px]' : 'xl:grid-cols-[minmax(0,1fr)_262px]',
      )}
    >
      {photo ? (
        <div
          data-slot="ticket-photo"
          className="relative aspect-video overflow-hidden rounded-t-[15px] bg-muted xl:aspect-auto xl:rounded-tr-none xl:rounded-bl-[15px]"
        >
          {/* `SlotImage` (next/image + loader Cloudinary) xin đúng cỡ qua `w_` thay vì tải ảnh
              gốc: dưới `xl` ảnh trải trọn bề ngang vé, từ `xl` là cột 210px (review P7 B17). */}
          <SlotImage
            image={photo}
            className="absolute inset-0"
            sizes="(min-width: 1280px) 210px, 100vw"
          />
        </div>
      ) : null}

      <div data-slot="ticket-body" className="flex min-w-0 flex-col">
        <div
          data-slot="ticket-band"
          className={cn(
            'flex h-[38px] items-center justify-between gap-3 bg-primary px-5 font-mono text-[11px] font-semibold tracking-[0.16em] text-primary-foreground uppercase sm:px-7',
            photo ? null : 'rounded-t-[15px] xl:rounded-tr-none',
          )}
        >
          <span className="truncate">{messages.passportVisa.kicker}</span>
          <span className="shrink-0">{booking.code}</span>
        </div>

        <div className="flex flex-1 flex-col px-5 pt-[18px] sm:px-7">
          {/* Điện thoại: mộc lên trên, sát phải; tên tour được trọn bề ngang bên dưới. */}
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="font-heading text-[22px] leading-[1.25] font-semibold text-balance">
                {booking.tourTitle}
              </h2>
              <Link
                href={`/tours/${booking.tourSlug}`}
                className="mt-0.5 inline-block text-[12.5px] font-semibold text-primary-emphasis underline-offset-4 hover:underline"
              >
                {messages.accountBookingDetail.viewTour} →
              </Link>
            </div>
            {/* Con dấu "đóng xuống" (nhóm motion 3, 19/08) — giữ nguyên như trang cũ. */}
            <RevealItem enter="stamp" delay={0.15} className="shrink-0 self-end sm:self-auto">
              <VisaStamp label={pass.stamp.label} tone={pass.stamp.tone} />
            </RevealItem>
          </div>

          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 py-4 sm:gap-6">
            <TicketDate label={t.ticket.departs} date={booking.departureStartDate} />
            <div className="relative flex h-[30px] items-center justify-center">
              <span
                aria-hidden="true"
                className="absolute inset-x-0 top-1/2 border-t-2 border-dashed border-border"
              />
              <span className="relative flex items-center gap-[7px] bg-card px-2.5 text-center text-[12.5px] font-semibold text-ink">
                <BusIcon aria-hidden="true" className="size-4 shrink-0" />
                {route}
              </span>
            </div>
            <TicketDate label={t.ticket.returns} date={booking.departureEndDate} alignEnd />
          </div>
        </div>

        {/* `gap-px` trên nền `bg-muted` vẽ đường kẻ giữa các ô ở mọi số cột. Không ảnh thì lưới
            nằm ở góc dưới-trái của vé ngang nên phải tự bo góc và cắt phần thừa. */}
        <dl
          className={cn(
            'grid grid-cols-2 gap-px border-t border-muted bg-muted lg:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4',
            photo ? null : 'overflow-hidden xl:rounded-bl-[15px]',
          )}
        >
          {facts.map((fact) => (
            <div key={fact.label} className="bg-card px-5 py-3.5 sm:px-7">
              <dt className={KICKER}>{fact.label}</dt>
              <dd className="mt-[5px] text-[13.5px] font-semibold">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Đường xé là viền gạch đứt của cuống: điện thoại nằm ngang (cuống ở dưới), từ `xl`
          nằm dọc (cuống bên phải). Hai vết khuyết là `::before`/`::after` ở globals.css. */}
      <div
        data-slot="ticket-stub"
        className="relative flex flex-col border-t-2 border-dashed border-border xl:border-t-0 xl:border-l-2"
      >
        <div className="flex h-[38px] items-center justify-center bg-primary font-mono text-[11px] font-semibold tracking-[0.16em] text-primary-foreground uppercase xl:rounded-tr-[15px]">
          {t.ticket.admit(booking.numAdults + booking.numChildren)}
        </div>
        <div className="flex flex-1 flex-col px-[26px] py-[18px]">
          <p className={KICKER}>{bookingTotalLabel(booking)}</p>
          <p className="mt-1.5 font-mono text-[28px] leading-[1.1] font-semibold tabular-nums">
            {formatBookingMoney(booking, booking.totalAmount)}
          </p>
          <p className="mt-0.5 text-[12.5px] text-muted-foreground">{t.ticket.taxesIncluded}</p>
          <div className="mt-auto pt-4">
            {pass.barcode ? (
              <TicketBarcode code={booking.code} className="h-11 justify-center" />
            ) : null}
            <p className="mt-2 text-center font-mono text-xs font-semibold tracking-[0.16em]">
              {booking.code}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

/** Ngày kiểu giờ bay: "03 NOV" chữ mono cỡ lớn, dưới là "Tue · 2026" (bản vẽ `.tk-big`, `.tk-sub`). */
function TicketDate({
  label,
  date,
  alignEnd = false,
}: {
  label: string;
  date: string;
  alignEnd?: boolean;
}) {
  const { weekday, day, month, year } = calendarDateParts(date);
  return (
    <div className={alignEnd ? 'text-right' : undefined}>
      <p className={KICKER}>{label}</p>
      <p className="mt-1.5 font-mono text-[26px] leading-[1.05] font-semibold sm:text-[34px]">
        {`${String(day).padStart(2, '0')} ${month.toUpperCase()}`}
      </p>
      <p className="mt-0.5 text-[12.5px] text-muted-foreground">{`${weekday} · ${year}`}</p>
    </div>
  );
}
