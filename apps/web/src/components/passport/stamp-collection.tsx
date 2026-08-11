import { messages } from '@tourism/i18n';
import type { StampSlot } from '@/lib/passport';

/**
 * BỘ SƯU TẬP TEM hợp nhất (addendum §7, user chọn hướng A 11/08) — thay cả
 * dãy tem rời lẫn bản đồ chấm vô danh: MỘT lưới ô mang tên địa danh thật.
 *
 * - `stamped`: con tem mực đóng thật — tròn/vuông + tháng + xoay lệch
 *   deterministic (từ `lib/passport`), mực `.stamp-ink` thấm giấy.
 * - `awaiting`: ô viền đứt "chờ đóng tem" — có chuyến sắp tới nơi này.
 * - `unexplored`: ô mờ ghi tên — lời mời khám phá, không phải dữ liệu chết.
 *
 * Tên địa danh là NỘI DUNG thật (không aria-hidden như bản đồ chấm cũ);
 * tháng/viền là trang trí đi kèm.
 */
export function StampCollection({ slots, caption }: { slots: StampSlot[]; caption: string }) {
  const t = messages.passportHome;
  return (
    <div>
      <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
        {slots.map((s) => (
          <li
            key={s.slug}
            style={s.state === 'stamped' ? { transform: `rotate(${s.rotationDeg}deg)` } : undefined}
            className={`relative flex aspect-square flex-col items-center justify-center p-2 text-center ${
              s.state === 'stamped'
                ? `stamp-ink border-[2.5px] border-ink text-ink opacity-85 ${
                    s.shape === 'square' ? 'rounded-2xl' : 'rounded-full'
                  }`
                : s.state === 'awaiting'
                  ? 'rounded-2xl border-2 border-dashed border-ink/45 text-ink/80'
                  : 'rounded-2xl border border-border/70 text-muted-foreground/80'
            }`}
          >
            {s.state === 'stamped' ? (
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute inset-[3px] border border-dashed border-ink/55 ${
                  s.shape === 'square' ? 'rounded-xl' : 'rounded-full'
                }`}
              />
            ) : null}
            <span
              className={`px-1 font-heading text-xs leading-tight tracking-wide ${
                s.state === 'unexplored' ? 'font-medium' : 'font-bold'
              }`}
            >
              {s.state === 'stamped' ? s.name.toUpperCase() : s.name}
            </span>
            {s.state === 'stamped' ? (
              <span className="mt-0.5 text-[8.5px] tracking-[0.12em] uppercase">{s.month}</span>
            ) : null}
            {s.state === 'awaiting' ? (
              <span className="mt-0.5 text-[8.5px] tracking-[0.12em] uppercase">
                {t.awaitingStamp}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted-foreground">{caption}</p>
    </div>
  );
}
