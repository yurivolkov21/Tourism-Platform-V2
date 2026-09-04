import { cn } from '@tourism/ui/lib/utils';
import type * as React from 'react';

/**
 * Một dòng `<dt>/<dd>` của khối chi tiết admin — nhãn cột trái, giá trị cột
 * phải, đặt trong một `<dl>` do người gọi dựng.
 *
 * Lên kit vì có SÁU bản chép đang sống: `/bookings/[code]`, `/enquiries/[id]`,
 * bước xác nhận của dialog Refund, `ConfirmWriteDialog`, và hai bản trong
 * `JsonDrawer` (`PayloadRow` chế độ Simple + `JsonDrawerField`). Sáu bản ấy
 * khác nhau đúng HAI thứ — bề rộng cột nhãn và việc nhãn có tự ngắt dòng hay
 * không — nên phần còn lại là chép thuần. Bản chép thứ 5 từng bị bỏ sót trọn
 * một vòng vá tràn chữ (03/09) đúng vì không ai biết nó tồn tại.
 *
 * `<dd>` LUÔN `wrap-anywhere` và cột giá trị luôn `minmax(0,1fr)`. Đây là bài
 * học đã trả giá: `1fr` trần nghĩa là `minmax(auto,1fr)`, mà `auto` lấy
 * min-content — một token không dấu cách (JSON lỗi provider, email dài) làm
 * phình cột rồi đẩy chữ ra ngoài mép panel. `break-words` KHÔNG đủ:
 * `overflow-wrap: break-word` không tính vào min-content, nên cột vẫn phình y
 * như cũ.
 */

/**
 * Bề rộng cột nhãn. Là BIẾN THỂ khai sẵn chứ không phải chuỗi truyền vào:
 * Tailwind quét class tĩnh trong mã nguồn, một `grid-cols-[${width}]` dựng
 * lúc chạy sẽ không có CSS nào cả (cùng lý do đã ghi ở `GRID_COLUMNS` của
 * `stat-card.tsx`).
 */
const WIDTH_CLASS = {
  /** 8rem — mặc định, cho nhãn một hai từ ("Status", "Contact email"). */
  sm: 'grid-cols-[8rem_minmax(0,1fr)]',
  /** 9rem — khối chi tiết `/bookings/[code]`, nhãn dài hơn một nhịp. */
  md: 'grid-cols-[9rem_minmax(0,1fr)]',
  /** 10rem — nhãn mang cả đường dẫn ("Data › Object › Metadata › Booking code"). */
  lg: 'grid-cols-[10rem_minmax(0,1fr)]',
} as const;

export type LabelValueWidth = keyof typeof WIDTH_CLASS;

export function LabelValueRow({
  label,
  value,
  width = 'sm',
  wrapLabel = false,
}: {
  label: string;
  /**
   * `ReactNode` chứ không `string`: chế độ Simple của `JsonDrawer` treo thêm
   * con số THÔ cạnh giá trị đã diễn giải, và `/bookings/[code]` gắn link. Nhờ
   * vậy kit không phải mọc thêm prop cho từng nhu cầu trang trí của một
   * consumer.
   */
  value: React.ReactNode;
  width?: LabelValueWidth;
  /**
   * Cho cột NHÃN tự ngắt dòng. Mặc định tắt — nhãn thường là một hai từ, và
   * ngắt chúng chỉ làm dòng cao lên vô cớ. Bật cho nhãn dạng đường dẫn: một
   * đường dẫn sâu tràn ra ngoài cũng là tràn.
   */
  wrapLabel?: boolean;
}) {
  return (
    <div className={cn('grid gap-2', WIDTH_CLASS[width])}>
      <dt className={cn('text-muted-foreground', wrapLabel && 'wrap-anywhere')}>{label}</dt>
      <dd className="wrap-anywhere">{value}</dd>
    </div>
  );
}
