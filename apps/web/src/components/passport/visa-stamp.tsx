import type { Booking } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { Plane } from 'lucide-react';
import type { BookingViewTone } from '@/lib/booking-vm';

/**
 * Mộc trạng thái của trang visa (M2) — MỘT ngôn ngữ dấu cho cả 5 status:
 * chữ từ `passportVisa.stampByStatus`, màu mực tra theo tone của
 * `bookingView` (KHÔNG if/else status trong JSX). Đóng nghiêng 4° cố định —
 * mộc công vụ đóng vội, không phải sticker dán thẳng.
 *
 * Ngữ pháp hình theo đời thật (gói tu sửa 11/08): OVAL = "nhập cảnh"
 * (chuyến còn phía trước — `phase: 'entry'`), CHỮ NHẬT kiểu Schengen kèm
 * pictogram máy bay = "xuất cảnh" (chuyến đã kết thúc — `phase: 'exit'`).
 * Mực qua `.stamp-ink`: multiply + mask nhiễu — thấm giấy, đứt quãng.
 */
const INK_CLASS: Record<BookingViewTone, string> = {
  success: 'border-success text-success',
  warning: 'border-warning text-warning',
  muted: 'border-muted-foreground text-muted-foreground',
  destructive: 'border-muted-foreground text-muted-foreground',
};

export function VisaStamp({
  status,
  tone,
  phase,
}: {
  status: Booking['status'];
  tone: BookingViewTone;
  phase: 'entry' | 'exit';
}) {
  return (
    <span
      className={`stamp-ink relative inline-block rotate-[4deg] border-2 font-heading text-[13px] font-bold tracking-[0.14em] whitespace-nowrap opacity-85 ${
        phase === 'entry' ? 'rounded-[50%] px-6 py-3' : 'rounded-xl px-3.5 py-2'
      } ${INK_CLASS[tone]}`}
    >
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-[3px] border border-dashed border-current opacity-55 ${
          phase === 'entry' ? 'rounded-[50%]' : 'rounded-lg'
        }`}
      />
      {phase === 'exit' ? (
        <Plane aria-hidden="true" className="absolute -top-1.5 -right-1.5 size-3.5 opacity-80" />
      ) : null}
      {messages.passportVisa.stampByStatus[status]}
    </span>
  );
}
