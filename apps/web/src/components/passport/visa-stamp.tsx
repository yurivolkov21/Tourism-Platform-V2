import type { BookingStamp, BookingViewTone } from '@/lib/booking-vm';

/**
 * Mộc trạng thái của trang visa (M2) — MỘT ngôn ngữ dấu cho mọi trạng thái: chữ và tông do nơi
 * gọi đưa (vé đọc `bookingPass(…).stamp` — mộc theo giai đoạn, ADR-0054 AMEND 1 §5), màu mực tra
 * theo tông (KHÔNG if/else status trong JSX). Đóng nghiêng 4° cố định — mộc công vụ đóng vội,
 * không phải sticker dán thẳng.
 *
 * Mực qua `.stamp-ink` (multiply + mask nhiễu — vòng tu sửa 11/08): thấm
 * giấy, đứt quãng. Biến thể oval/pictogram máy bay đã thử và bị user bác —
 * giữ một hình chữ nhật bo góc cho mọi trạng thái.
 */
const INK_CLASS: Record<BookingViewTone, string> = {
  success: 'border-success text-success',
  warning: 'border-warning text-warning',
  muted: 'border-muted-foreground text-muted-foreground',
  destructive: 'border-muted-foreground text-muted-foreground',
};

export function VisaStamp({ label, tone }: BookingStamp) {
  return (
    <span
      className={`stamp-ink relative inline-block rotate-[4deg] rounded-xl border-2 px-3.5 py-2 font-heading text-[13px] font-bold tracking-[0.14em] whitespace-nowrap opacity-85 ${INK_CLASS[tone]}`}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-[3px] rounded-lg border border-dashed border-current opacity-55"
      />
      {label}
    </span>
  );
}
