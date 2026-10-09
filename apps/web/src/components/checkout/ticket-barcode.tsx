import { cn } from '@tourism/ui/lib/utils';
import { ticketBarcodeWidths } from '@/lib/checkout';

/**
 * Mã vạch trang trí, tất định theo mã đơn (`ticketBarcodeWidths`) — MỘT bản vẽ cho cuống hoá đơn
 * (`BookingReceipt`), vé của trang chi tiết đơn và voucher. Trước đó mỗi nơi tự chép phần vẽ vạch
 * cùng móc in, và ba bản đã trôi khỏi nhau (bản của vé thiếu `max-w-full`/`overflow-hidden`;
 * vạch `bg-foreground` ở hai bản, `bg-current` ở bản thứ ba — review P7 B13, C#15).
 *
 * Có hiện mã vạch hay không là việc của nơi gọi (`bookingPass` hay `isVoucher` của hoá đơn) —
 * linh kiện này chỉ vẽ. `className` của nơi gọi mang chiều cao, căn lề, khoảng cách, nền quiet zone.
 *
 * `data-slot="barcode"` là móc của quy tắc in `print-color-adjust: exact` ở `globals.css`: vạch vẽ
 * bằng NỀN, trình duyệt tắt "in nền" thì mất vạch nếu thiếu móc. Vạch `bg-current` trên chữ
 * `text-foreground`: trên màn hình là màu chữ của theme; khi in voucher, quy tắc in của mảng teal
 * cho mọi con kế thừa màu mực của mảng (đen), nên vạch in đen mà không cần class riêng.
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
