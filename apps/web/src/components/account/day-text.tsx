import { cn } from '@tourism/ui/lib/utils';

/**
 * Lịch trình một ngày in NGUYÊN VĂN (luật catalog: không tách giờ ra thành dữ liệu) — chữ mono trên
 * nền muted, giữ xuống dòng của admin. Một bản cho Get ready (ngày 1, `clamp` cắt 4 dòng) và Today's
 * plan (ngày đang đi, in trọn) — trước là hai bản chép tay (review P7 B18).
 *
 * Đệm và nền nằm ở lớp bọc, không ở thẻ chữ: `line-clamp` cắt (`overflow: hidden`) ở mép VÙNG ĐỆM,
 * nên đệm đặt chung chỗ với `line-clamp` thì nửa trên dòng thứ năm lộ ra trong đệm dưới (đo bằng CSS
 * build thật, Task B8). Chuỗi liền dài (một link) bẻ ở bất kỳ đâu thay vì đẩy trang cuộn ngang
 * (review P7 S2).
 */
export function DayText({
  text,
  clamp = false,
  className,
}: {
  text: string;
  clamp?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg bg-muted/55 px-[11px] py-2', className)}>
      <p
        data-slot="day-text"
        className={cn(
          'font-mono text-[11.5px] leading-[1.65] whitespace-pre-line [overflow-wrap:anywhere]',
          clamp && 'line-clamp-4',
        )}
      >
        {text}
      </p>
    </div>
  );
}
