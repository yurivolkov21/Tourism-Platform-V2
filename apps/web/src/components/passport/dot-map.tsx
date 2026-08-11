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
      <ul className="grid grid-cols-9 gap-2 py-1">
        {dots.map((d) => (
          <li
            key={d.name}
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
