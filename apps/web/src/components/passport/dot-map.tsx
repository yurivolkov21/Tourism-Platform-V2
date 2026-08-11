import type { MapDot } from '@/lib/passport';

/**
 * Bản đồ CHẤM cách điệu — mỗi chấm là một destination THẬT của catalog, gom
 * cụm theo miền (đã sort bắc→trung→nam từ `mapDots`), KHÔNG phải toạ độ địa
 * lý và caption phải nói thật điều đó (đếm theo catalog). Đã đến = chấm
 * primary đầy; sắp đến = primary mờ; còn lại = muted.
 */
export function DotMap({ dots, caption }: { dots: MapDot[]; caption: string }) {
  return (
    <figure className="rounded-2xl border border-border bg-card p-5">
      {/* aria-hidden (fix 11/08): lưới chấm CÁCH ĐIỆU, không phải danh sách
          thông tin — mỗi chấm chỉ có `title` (tooltip hover chuột), không có
          gì cho trình đọc màn hình đọc ra có ích; `figcaption` bên dưới đã
          nói hết nội dung thật (đếm bao nhiêu/tổng bao nhiêu). */}
      <ul aria-hidden="true" className="grid grid-cols-9 gap-2 py-1">
        {dots.map((d) => (
          <li
            key={d.slug}
            title={d.name}
            className={`aspect-square w-full rounded-full ${
              d.visited ? 'bg-primary' : d.upcoming ? 'bg-primary opacity-40' : 'bg-muted'
            }`}
          />
        ))}
      </ul>
      <figcaption className="mt-2 text-[12.5px] text-muted-foreground">{caption}</figcaption>
    </figure>
  );
}
