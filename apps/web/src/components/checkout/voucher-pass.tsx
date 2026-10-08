import type { BookingDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import { ArrowRightIcon, CalendarIcon, CheckIcon, UsersIcon } from 'lucide-react';
import Link from 'next/link';
import { VoucherCancelledNotice, VoucherCode } from '@/components/checkout/voucher-code';
import { bookingPriceLines, formatBookingMoney, ticketBarcodeWidths } from '@/lib/checkout';
import { formatMoneyExact } from '@/lib/tours';
import type { VoucherJournalItem, VoucherView } from '@/lib/voucher';

/**
 * Cột phải của voucher — mảng teal 440px (spec P7 §6.3): ô mã đơn kèm ngày đi, "Admit n",
 * dòng điều kiện và mã vạch; Receipt overview; Trip journal; nút trắng "View booking".
 *
 * Nền `bg-primary`, KHÔNG `bg-primary-emphasis` như chữ của spec §4.3: `primary-emphasis` là
 * token VAI CHỮ (`tokens.mjs` — "KHÔNG dùng cho bg-*"), ở dark mode nó sáng lên L 0.76 và chữ
 * trắng trên đó chưa tới 2:1. `primary` là vai bề mặt, cõng `primary-foreground` ở cả hai theme;
 * ở light hai token trùng giá trị nên màu bản vẽ không đổi.
 *
 * Chữ phụ dùng `primary-foreground/90`, không mờ hơn: mức /72 của bản vẽ đặt trên `primary`
 * của site tụt dưới 4.5:1.
 */
export function VoucherPass({ booking, view }: { booking: BookingDetail; view: VoucherView }) {
  const t = messages.voucher;
  const refunded = Number(booking.refundedTotal) > 0;
  return (
    <div
      data-slot="voucher-pass"
      className="bg-primary px-6 py-7 text-primary-foreground md:px-8 md:pt-7.5 md:pb-8.5"
    >
      {/* Đơn còn hiệu lực: khối luôn hiện (ngày, điều kiện, mã vạch), chỉ ô mã giấu khi thẻ một
          cột (dưới `xl`, cùng mốc chia cột của `VoucherCard`) vì cột trái đã có ô gọn. Đơn đã
          huỷ: khối chỉ còn dải hết hiệu lực mà cột trái đã nói khi thẻ một cột, nên giấu cả
          khối ở đó; khi in thì hiện lại. */}
      <div
        data-slot="voucher-ticket"
        className={cn(
          'rounded-2xl bg-card px-4.5 py-4 text-card-foreground',
          !view.showCode && 'max-xl:hidden print:block',
        )}
      >
        {view.showCode ? (
          <>
            <VoucherCode code={booking.code} className="max-xl:hidden print:flex" />
            <div
              data-slot="voucher-meta"
              className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground max-xl:mt-0 print:mt-2.5"
            >
              <span className="inline-flex items-center gap-1.5">
                <CalendarIcon aria-hidden="true" className="size-3.5" />
                {view.departure}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <UsersIcon aria-hidden="true" className="size-3.5" />
                {t.admit(booking.numAdults + booking.numChildren)}
              </span>
            </div>
            <ul data-slot="voucher-conditions" className="mt-2.5 grid gap-1.5 text-[12.5px]">
              {view.conditions.map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <CheckIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-success" />
                  {line}
                </li>
              ))}
            </ul>
            {view.showBarcode ? <Barcode code={booking.code} /> : null}
          </>
        ) : view.cancelledNotice ? (
          <VoucherCancelledNotice text={view.cancelledNotice} />
        ) : null}
      </div>

      <section data-slot="voucher-receipt" className="mt-5.5">
        <h3 className="mb-2 text-base font-semibold">{t.receiptHeading}</h3>
        <dl className="text-[13.5px]">
          {bookingPriceLines(booking).map((line) => (
            <div key={line.label} className="flex justify-between gap-4 py-0.5">
              <dt className="text-primary-foreground/90">{line.label}</dt>
              <dd className="font-mono tabular-nums">{line.amount}</dd>
            </div>
          ))}
          <div className="mt-1.5 flex justify-between gap-4 border-t border-primary-foreground/25 pt-2 text-[15px] font-bold">
            <dt>{messages.booking.success.totalLabel}</dt>
            <dd className="font-mono tabular-nums">
              {formatBookingMoney(booking, booking.totalAmount)}
            </dd>
          </div>
          {/* Số tiền THẬT đã về tài khoản khách — đủ hai số lẻ (`formatMoneyExact`), khác giá
              tour làm tròn ở các dòng trên. */}
          {refunded ? (
            <div className="flex justify-between gap-4 py-0.5">
              <dt className="text-primary-foreground/90">{t.refunded}</dt>
              <dd className="font-mono tabular-nums">
                {t.refundedAmount(formatMoneyExact(booking.refundedTotal, booking.currency))}
              </dd>
            </div>
          ) : null}
        </dl>
      </section>

      <section
        data-slot="voucher-journal"
        className="mt-4.5 rounded-2xl bg-primary-foreground/10 px-4 py-3.5"
      >
        <h3 className="mb-2.5 font-semibold">{t.journal.heading}</h3>
        <ol>
          {view.journal.map((item) => (
            <JournalItem key={item.label} item={item} />
          ))}
        </ol>
      </section>

      <Link
        href={`/account/bookings/${booking.code}`}
        className="mt-5 flex h-11 items-center justify-center gap-2 rounded-xl bg-card font-bold text-primary-emphasis outline-none transition-colors hover:bg-card/90 focus-visible:ring-3 focus-visible:ring-primary-foreground/60 print:hidden"
      >
        {messages.booking.success.viewBooking}
        <ArrowRightIcon aria-hidden="true" className="size-4" />
      </Link>
      <Link
        href="/tours"
        className="mx-auto mt-3 block w-fit rounded-sm text-[13px] underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/60 print:hidden"
      >
        {messages.booking.success.viewTours}
      </Link>
    </div>
  );
}

/**
 * Mã vạch trang trí, tất định theo mã đơn (`ticketBarcodeWidths`, cùng nguồn với cuống hoá
 * đơn). `data-slot="barcode"` ăn quy tắc in `print-color-adjust: exact` có sẵn ở `globals.css`
 * — vạch vẽ bằng nền, tắt "in nền" là mất vạch. Vạch `bg-current` để bản in tô chúng bằng màu
 * mực của mảng teal (đen), không bằng màu chữ của theme.
 */
function Barcode({ code }: { code: string }) {
  return (
    <div
      data-slot="barcode"
      aria-hidden="true"
      className="mt-3 flex h-7.5 max-w-full items-stretch overflow-hidden text-foreground"
    >
      {ticketBarcodeWidths(code).map((width, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: mảng tất định từ `code`, không đổi thứ tự
          key={`${code}-${i}`}
          className={i % 2 === 0 ? 'bg-current' : 'bg-transparent'}
          style={{ width: `${width}px` }}
        />
      ))}
    </div>
  );
}

/** Một mốc của Trip journal: vòng tròn (tích khi đã xong), nhãn, dòng phụ; vạch nối tới mốc sau. */
function JournalItem({ item }: { item: VoucherJournalItem }) {
  return (
    <li className="relative grid grid-cols-[1.25rem_minmax(0,1fr)] gap-2.5 pb-3 text-[13px] before:absolute before:top-5 before:bottom-0 before:left-[9.5px] before:w-px before:bg-primary-foreground/35 last:pb-0 last:before:hidden">
      {item.done ? (
        <span
          role="img"
          aria-label={messages.voucher.journal.done}
          className="grid size-5 place-items-center rounded-full border-[1.5px] border-primary-foreground bg-primary-foreground text-primary"
        >
          <CheckIcon aria-hidden="true" className="size-3" strokeWidth={3} />
        </span>
      ) : (
        <span
          aria-hidden="true"
          className="size-5 rounded-full border-[1.5px] border-primary-foreground"
        />
      )}
      <div className="min-w-0">
        <p className="font-semibold">{item.label}</p>
        {item.detail ? <p className="text-xs text-primary-foreground/90">{item.detail}</p> : null}
      </div>
    </li>
  );
}
