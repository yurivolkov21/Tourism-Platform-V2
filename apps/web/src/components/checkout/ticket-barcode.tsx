import { cn } from '@tourism/ui/lib/utils';
import { ticketBarcodeWidths } from '@/lib/checkout';

/**
 * Mã vạch trang trí, tất định theo mã đơn (`ticketBarcodeWidths`) — MỘT bản vẽ cho vé của trang
 * chi tiết đơn và voucher. Trước đó mỗi nơi tự chép phần vẽ vạch cùng móc in, và ba bản (cả cuống
 * hoá đơn `BookingReceipt`, nay thôi in mã vạch — review cuối P7, M3) đã trôi khỏi nhau (bản của vé
 * thiếu `max-w-full`/`overflow-hidden`; vạch `bg-foreground` ở hai bản, `bg-current` ở bản thứ ba —
 * review P7 B13, C#15).
 *
 * Có hiện mã vạch hay không là việc của nơi gọi (`bookingPass`) — linh kiện này chỉ vẽ.
 * `className` của nơi gọi mang chiều cao, căn lề, khoảng cách, nền quiet zone.
 *
 * `data-slot="barcode"` là móc của luật in `print-color-adjust: exact` ở `globals.css` (vé trang chi
 * tiết đơn khi in); tài liệu in G40 tự ép qua `[data-print-doc]`. Vạch `bg-current` trên chữ
 * `text-foreground` — trong tài liệu in là mực tối của phạm vi `.light`.
 */
export function TicketBarcode({ code, className }: { code: string; className?: string }) {
  return (
    <div
      data-slot="barcode"
      aria-hidden="true"
      className={cn('flex max-w-full items-stretch overflow-hidden text-foreground', className)}
    >
      {ticketBarcodeWidths(code).map((width, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: mảng tất định từ `code`, không đổi thứ tự
          key={`${code}-${index}`}
          className={index % 2 === 0 ? 'bg-current' : 'bg-transparent'}
          style={{ width: `${width}px` }}
        />
      ))}
    </div>
  );
}
