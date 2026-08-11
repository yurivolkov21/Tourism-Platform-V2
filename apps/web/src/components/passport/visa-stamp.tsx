import type { Booking } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import type { BookingViewTone } from '@/lib/booking-vm';

/**
 * Mộc trạng thái của trang visa (M2) — MỘT ngôn ngữ dấu cho cả 5 status:
 * chữ từ `passportVisa.stampByStatus`, màu mực tra theo tone của
 * `bookingView` (KHÔNG if/else status trong JSX). Đóng nghiêng 4° cố định —
 * mộc công vụ đóng vội, không phải sticker dán thẳng.
 */
const INK_CLASS: Record<BookingViewTone, string> = {
  success: 'border-success text-success',
  warning: 'border-warning text-warning',
  muted: 'border-muted-foreground text-muted-foreground',
  destructive: 'border-muted-foreground text-muted-foreground',
};

export function VisaStamp({ status, tone }: { status: Booking['status']; tone: BookingViewTone }) {
  return (
    <span
      className={`relative inline-block rotate-[4deg] rounded-xl border-2 px-3.5 py-2 font-heading text-[13px] font-bold tracking-[0.14em] whitespace-nowrap opacity-85 ${INK_CLASS[tone]}`}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-[3px] rounded-lg border border-dashed border-current opacity-55"
      />
      {messages.passportVisa.stampByStatus[status]}
    </span>
  );
}
