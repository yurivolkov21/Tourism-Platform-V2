import type { Booking } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import { CopyCodeButton } from '@/components/checkout/copy-code-button';
import type { CheckoutMood } from '@/lib/checkout';
import { ticketBarcodeWidths, ticketSerial } from '@/lib/checkout';
import { formatDateRange, formatMoney, formatTicketDate } from '@/lib/tours';

/**
 * Hoá đơn kiêm cuống vé cho `/checkout/success` — thay `CheckoutShell` (tấm vé
 * boarding-pass) từ 19/08. Dựng theo wireframe user duyệt qua bốn bước, xem
 * `docs/design/mockups/receipt-ticket.src.html`.
 *
 * **Ý tưởng hợp nhất, gói trong một câu:** giữ receipt làm TÀI LIỆU và biến dải
 * chân của nó thành CUỐNG VÉ. Dải chân vốn đã tràn hết bề rộng card, có nền
 * riêng và ngăn bằng một đường ở mép dưới — đúng giải phẫu một phần xé rời, nên
 * việc cần làm chỉ là nâng cái đường sẵn có thành ẩn dụ, không phải gắn thêm đồ
 * trang trí.
 *
 * Vì sao mọi thứ khác của tấm vé không mang sang: chúng TRÙNG với receipt —
 * pill trùng băng màu, cột TRAVELLERS trùng cuống cũ, hàng thương hiệu trùng
 * dải header. Chỉ ba thứ là receipt thiếu thật: mã cỡ lớn, barcode, serial.
 *
 * CỐ Ý không dùng `border: dashed` và không notch bán nguyệt: JSDoc
 * `CheckoutShell` ghi rõ bản trước nó bị bác vì đúng combo đó ("cliché card giả
 * vờ làm vé"). Đường xé ở đây là hàng chấm — cùng công thức `TicketTear`.
 *
 * `CheckoutShell` KHÔNG bị xoá: `/checkout/cancel` vẫn dùng, và nó truyền `code`
 * nên dùng nhánh vé đầy đủ (user chốt 19/08 giữ nguyên trang đó).
 */
const TONE = {
  confirmed: 'border-b-success',
  confirming: 'border-b-warning',
  settled: 'border-b-muted-foreground',
} as const satisfies Record<CheckoutMood, string>;

const PILL = {
  confirmed: 'bg-success text-success-foreground',
  confirming: 'bg-warning text-warning-foreground',
  settled: 'bg-muted text-muted-foreground',
} as const satisfies Record<CheckoutMood, string>;

const PROVIDER_LABEL = {
  STRIPE: messages.booking.form.stripe,
  PAYPAL: messages.booking.form.paypal,
} as const;

export function BookingReceipt({ booking, mood }: { booking: Booking; mood: CheckoutMood }) {
  const t = messages.booking.success;
  const ts = messages.checkoutSummary;

  const statusLabel =
    mood === 'confirmed'
      ? t.statusPaid
      : mood === 'confirming'
        ? t.statusConfirming
        : t.statusSettled;

  const isDayTrip = booking.departureStartDate === booking.departureEndDate;
  const departure = isDayTrip
    ? formatTicketDate(booking.departureStartDate)
    : formatDateRange(booking.departureStartDate, booking.departureEndDate);

  // Đã đi rồi thì nói "Departed", chưa đi thì "Departs" — một dòng chỉ đúng một
  // nửa thời gian là dòng sẽ sai trước mắt khách ở nửa còn lại.
  const departed = new Date(booking.departureEndDate) < new Date();

  const adultsAmount = formatMoney(
    (Number(booking.unitPrice) * booking.numAdults).toFixed(2),
    booking.currency,
  );
  const childrenAmount = formatMoney(
    (Number(booking.unitPrice) * booking.numChildren).toFixed(2),
    booking.currency,
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4">
      {/* Card: KHÔNG padding hai bên — mỗi khối tự mang `px-4`, còn cuống thì
          tràn hết bề rộng nên phải nằm ngoài padding đó (đúng khung wireframe). */}
      <div className="flex flex-col gap-4 overflow-hidden rounded-2xl border bg-card pt-4">
        <div className="flex flex-col gap-4 px-4 pb-1 sm:flex-row sm:justify-between">
          <div className="flex flex-col items-start gap-2">
            <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', PILL[mood])}>
              {statusLabel}
            </span>
            <h1 className="font-heading text-2xl font-medium tracking-tight text-balance md:text-3xl">
              {mood === 'confirmed'
                ? t.confirmedTitle
                : mood === 'confirming'
                  ? t.pendingTitle
                  : t.settledTitle}
            </h1>
            <p className="text-sm text-muted-foreground">{t.receiptSentTo(booking.contactEmail)}</p>
          </div>

          <dl className="grid shrink-0 grid-cols-[auto_auto] items-baseline gap-x-4 gap-y-1.5 text-xs sm:text-right">
            <dt className="font-medium">{t.bookingMetaLabel}</dt>
            <dd className="font-mono text-muted-foreground">{booking.code}</dd>
            <dt className="font-medium">{t.dateMetaLabel}</dt>
            <dd className="font-mono text-muted-foreground">
              {formatTicketDate((booking.paidAt ?? booking.createdAt).slice(0, 10))}
            </dd>
          </dl>
        </div>

        {/* Ba cột — thay `SHIP TO`/`BILL TO`/`PAYMENT` của mẫu gốc. Dự án không
            giao gì nên không có địa chỉ nào để in; hai cột đó đổi sang thứ một
            chuyến đi thật sự cần. */}
        <div className="grid gap-5 px-4 sm:grid-cols-3">
          <Column label={t.travellersLabel}>
            <p className="font-medium">{booking.contactName}</p>
            <p className="text-muted-foreground">{booking.contactEmail}</p>
            {booking.contactPhone ? (
              <p className="text-muted-foreground">{booking.contactPhone}</p>
            ) : null}
            <p className="text-muted-foreground">
              {ts.adultsLine(booking.numAdults)}
              {booking.numChildren > 0 ? `, ${ts.childrenLine(booking.numChildren)}` : ''}
            </p>
          </Column>

          <Column label={t.tripLabel}>
            <p className="font-medium tabular-nums">{departure}</p>
            <p className="text-muted-foreground">{booking.tourTitle}</p>
            {booking.tourDestinations.length > 0 ? (
              <p className="text-muted-foreground">
                {booking.tourDestinations.map((d) => d.name).join(' · ')}
              </p>
            ) : null}
          </Column>

          <Column label={t.paymentLabel}>
            <p className="font-medium">{PROVIDER_LABEL[booking.paymentProvider]}</p>
            {/* Sandbox disclosure — dùng LẠI key đã có, không bịa key trùng nghĩa. */}
            <p className="text-muted-foreground">{messages.tourDetail.booking.testMode}</p>
            {booking.paidAt ? (
              <p className="pt-1 text-muted-foreground">
                {t.paidAtLine(formatTicketDate(booking.paidAt.slice(0, 10)))}
              </p>
            ) : null}
          </Column>
        </div>

        <div className="mx-4 h-px bg-border" />

        {/* Một dòng hàng = chính chuyến đi. Giá in ở đây là ĐƠN GIÁ, không phải
            tổng: mẫu gốc có ba món nên giá dòng khác tổng, ở đây chỉ một tour
            nên in tổng sẽ khiến cùng một số hiện hai lần mà không nói thêm gì. */}
        <div className="flex items-start gap-4 px-4">
          {booking.tourImage ? (
            // `<img>` thường, KHÔNG `next/image` — cùng lý do đã ghi ở
            // `checkout-summary.tsx`: host media chưa khai trong `remotePatterns`.
            // biome-ignore lint/performance/noImgElement: lý do ở comment trên.
            <img
              src={booking.tourImage.url}
              alt={booking.tourImage.alt ?? ''}
              className="size-16 shrink-0 rounded-md object-cover"
            />
          ) : (
            <div aria-hidden="true" className="size-16 shrink-0 rounded-md bg-muted" />
          )}
          <div className="min-w-0 flex-1">
            {booking.tourDestinations[0] ? (
              <p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
                {booking.tourDestinations[0].name}
              </p>
            ) : null}
            <p className="font-medium">{booking.tourTitle}</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {departure} · {t.guestsCount(booking.numAdults + booking.numChildren)}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="font-semibold tabular-nums">
              {formatMoney(booking.unitPrice, booking.currency)}
            </p>
            <p className="text-xs text-muted-foreground">{t.perTraveller}</p>
          </div>
        </div>

        <div className="mx-4 h-px bg-border" />

        <dl className="ml-auto w-full max-w-xs px-4 pb-1">
          <Row k={ts.adultsLine(booking.numAdults)} v={adultsAmount} />
          {booking.numChildren > 0 ? (
            <Row k={ts.childrenLine(booking.numChildren)} v={childrenAmount} />
          ) : null}
          <div className="mt-3 flex items-baseline justify-between border-t pt-3">
            <dt className="font-semibold">{t.totalLabel}</dt>
            <dd className="font-heading text-lg font-semibold tabular-nums">
              {formatMoney(booking.totalAmount, booking.currency)}
            </dd>
          </div>
          <p className="mt-1 text-right text-xs text-muted-foreground">{ts.taxesNote}</p>
        </dl>

        <Stub booking={booking} mood={mood} departed={departed} departure={departure} />
      </div>

      <p className="mt-3 text-center text-sm text-muted-foreground">{t.needHelp}</p>
    </div>
  );
}

function Column({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 font-mono text-xs tracking-widest text-muted-foreground uppercase">
        {label}
      </p>
      <div className="flex flex-col gap-0.5 text-sm">{children}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between py-1 text-sm">
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="tabular-nums">{v}</dd>
    </div>
  );
}

/**
 * Cuống vé — phần xé rời của tài liệu.
 *
 * Đường xé vẽ bằng background XẾP LỚP trên mép trên, KHÔNG phải một thẻ riêng:
 * thẻ riêng sẽ thành con của card (flex column có `gap`) nên tự ăn thêm khoảng
 * cách và lơ lửng cách cuống — đo được lúc dựng wireframe, card phồng 628→645.
 *
 * Băng trạng thái là `border-b`, bám mép NGOÀI của cuống. Ở tấm vé cũ cuống nằm
 * bên phải nên băng bám mép phải; cuống ở đây nằm dưới đáy nên băng bám mép
 * dưới — cùng luật "băng thuộc về cuống", chỉ khác trục.
 */
function Stub({
  booking,
  mood,
  departed,
  departure,
}: {
  booking: Booking;
  mood: CheckoutMood;
  departed: boolean;
  departure: string;
}) {
  const t = messages.booking.success;
  const widths = ticketBarcodeWidths(booking.code);

  return (
    <div
      data-slot="stub"
      className={cn(
        'flex flex-col gap-5 border-b-3 bg-muted/40 p-4 sm:flex-row sm:items-start sm:justify-between',
        // Hàng chấm 1px nhịp 8px, dính ĐÚNG mép trên — cùng công thức `TicketTear`.
        '[background-image:radial-gradient(circle,var(--border)_1px,transparent_1.1px)]',
        '[background-position:top_left] [background-repeat:repeat-x] [background-size:8px_2px]',
        TONE[mood],
      )}
    >
      <div>
        <p className="font-medium">{departed ? t.departedOn(departure) : t.departsOn(departure)}</p>
        <p className="text-xs text-muted-foreground">{t.stubShowCode}</p>
      </div>

      <div className="flex flex-col items-start gap-1.5 sm:items-end">
        <p className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-primary" />
          {t.refLabel}
        </p>
        <div className="flex items-center gap-2">
          <p className="font-mono text-xl font-medium tracking-[0.06em] tabular-nums">
            {booking.code}
          </p>
          <CopyCodeButton code={booking.code} />
        </div>
        {/* Quiet zone `bg-card` (màu giấy của thân), không phải trắng cứng —
            giữ tokens-only mà vẫn tương phản cao ở cả hai theme. */}
        <div
          data-slot="barcode"
          aria-hidden="true"
          className="flex h-10 max-w-full items-stretch overflow-hidden bg-card px-2.5 py-1.5"
        >
          {widths.map((w, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: mảng deterministic từ `code`, không reorder
              key={`${booking.code}-${i}`}
              className={i % 2 === 0 ? 'bg-foreground' : 'bg-transparent'}
              style={{ width: `${w}px` }}
            />
          ))}
        </div>
        <p className="font-mono text-[9px] tracking-widest text-muted-foreground">
          NO. {ticketSerial(booking.code)}
        </p>
      </div>
    </div>
  );
}
