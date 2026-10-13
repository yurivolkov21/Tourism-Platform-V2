import type { BookingDetail } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { CalendarIcon, CheckIcon, InfoIcon, UsersIcon } from 'lucide-react';
import Link from 'next/link';
import { PendingAction, PendingCode } from '@/components/checkout/pending-action';
import type { PendingView } from '@/lib/pending-receipt';
import type { VoucherJournalItem } from '@/lib/voucher';

/**
 * Cột phải của thẻ chờ (G42, spec 2026-10-13 §4) — mảng `muted` 440px ở chỗ mảng teal của voucher:
 * ô mã viền đứt kèm ngày đi, số khách, dòng điều kiện và dải gạch chéo thay mã vạch; Receipt
 * overview; Trip journal; hành động chính; link "View booking".
 *
 * Không mã vạch: mã của đơn chưa trả chưa phải giấy vào cổng (cùng bất biến `bookingPass`). Không
 * "Admit n" vì cùng lẽ đó — dòng meta chỉ nói số khách.
 *
 * Ô mã và hành động chỉ hiện khi thẻ chia đôi (từ `xl`): dưới đó cột trái đã có bản gọn ngay dưới
 * câu phụ (`voucher-stack:` của `globals.css`, cùng luật ô mã của voucher).
 */
export function PendingPass({ booking, view }: { booking: BookingDetail; view: PendingView }) {
  const v = messages.voucher;
  return (
    <div data-slot="pending-pass" className="bg-muted px-6 py-7 md:px-8 md:pt-7.5 md:pb-8.5">
      <div
        data-slot="pending-ticket"
        className="rounded-2xl border-[1.5px] border-dashed bg-card px-4.5 py-4 voucher-stack:hidden"
      >
        <PendingCode code={booking.code} label={view.codeLabel} className="border-0 p-0" />
        {view.showMeta ? (
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon aria-hidden="true" className="size-3.5" />
              {view.departure}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <UsersIcon aria-hidden="true" className="size-3.5" />
              {messages.accountBookings.travellers(booking.numAdults, booking.numChildren)}
            </span>
          </div>
        ) : null}
        {view.conditions.length > 0 ? (
          <ul data-slot="pending-conditions" className="mt-2.5 grid gap-1.5 text-[12.5px]">
            {view.conditions.map((line) => (
              <li key={line} className="flex items-start gap-2">
                {/* Dấu "i", không dấu tích: điều kiện của đơn chưa trả không phải quyền lợi. */}
                <InfoIcon
                  aria-hidden="true"
                  className="mt-0.5 size-3.5 shrink-0 text-muted-foreground"
                />
                {line}
              </li>
            ))}
          </ul>
        ) : null}
        {/* Dải gạch chéo ở chỗ mã vạch của voucher — cùng hoạ tiết cuống "Unpaid" của bản in B1. */}
        <p
          data-slot="pending-band"
          className="mt-3 rounded-md border bg-[repeating-linear-gradient(135deg,var(--muted)_0_6px,var(--card)_6px_12px)] py-1.5 text-center font-mono text-[11px] font-semibold tracking-[0.18em] uppercase"
        >
          {view.band}
        </p>
      </div>

      <section data-slot="pending-receipt" className="mt-5.5 voucher-stack:mt-0">
        <h3 className="mb-2 text-base font-semibold">{v.receiptHeading}</h3>
        <dl className="text-[13.5px]">
          {view.priceLines.map((line) => (
            <div key={line.label} className="flex justify-between gap-4 py-0.5">
              <dt className="text-muted-foreground">{line.label}</dt>
              <dd className="font-mono tabular-nums">{line.amount}</dd>
            </div>
          ))}
          <div className="mt-1.5 flex justify-between gap-4 border-t border-foreground/20 pt-2 text-[15px] font-bold">
            <dt>{view.total.label}</dt>
            <dd className="font-mono tabular-nums">{view.total.amount}</dd>
          </div>
          {view.settlement ? (
            <div className="flex justify-between gap-4 py-0.5">
              <dt className="text-muted-foreground">{view.settlement.label}</dt>
              <dd className="font-mono tabular-nums">{view.settlement.amount}</dd>
            </div>
          ) : null}
        </dl>
        {view.showTaxes ? (
          <p className="mt-1 text-xs text-muted-foreground">{messages.checkoutSummary.taxesNote}</p>
        ) : null}
      </section>

      <section
        data-slot="pending-journal"
        className="mt-4.5 rounded-2xl border bg-card px-4 py-3.5"
      >
        <h3 className="mb-2.5 font-semibold">{v.journal.heading}</h3>
        <ol>
          {view.journal.map((item, index) => (
            <JournalItem key={item.label} item={item} last={index === view.journal.length - 1} />
          ))}
        </ol>
      </section>

      <div className="mt-5 voucher-stack:hidden">
        <PendingAction booking={booking} action={view.action} />
      </div>
      <Link
        href={`/account/bookings/${booking.code}`}
        className="mx-auto mt-3 block w-fit rounded-sm text-[13px] font-semibold text-primary-emphasis underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {messages.booking.success.viewBooking}
      </Link>
    </div>
  );
}

/**
 * Một mốc của Trip journal trên nền card — cùng hình mốc của `VoucherPass` (vòng tròn, tích khi đã
 * xong, vạch nối là viền của phần tử thật) nhưng màu `foreground` thay chữ trắng trên teal.
 */
function JournalItem({ item, last }: { item: VoucherJournalItem; last: boolean }) {
  return (
    <li className="relative grid grid-cols-[1.25rem_minmax(0,1fr)] gap-2.5 pb-3 text-[13px] last:pb-0">
      {last ? null : (
        <span
          aria-hidden="true"
          data-slot="journal-line"
          className="absolute top-5 bottom-0 left-[9.5px] border-l border-foreground/30"
        />
      )}
      {item.done ? (
        <span
          role="img"
          aria-label={messages.voucher.journal.done}
          className="grid size-5 place-items-center rounded-full bg-foreground text-background"
        >
          <CheckIcon aria-hidden="true" className="size-3" strokeWidth={3} />
        </span>
      ) : (
        <span
          aria-hidden="true"
          className="size-5 rounded-full border-[1.5px] border-muted-foreground"
        />
      )}
      <div className="min-w-0">
        <p className="font-semibold">{item.label}</p>
        {item.detail ? <p className="text-xs text-muted-foreground">{item.detail}</p> : null}
      </div>
    </li>
  );
}
