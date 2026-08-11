import { messages } from '@tourism/i18n';
import type { PageStamp } from '@/lib/passport';

/**
 * TRANG VISA MỞ (vòng 11/08 tối — thay lưới ô đều bị user chê tầm thường):
 * một tờ trang sổ (cùng chất khung với PassportCard) với nếp gấp giữa + số
 * trang ở góc, tem đóng RẢI HỮU CƠ lên đó theo TỪNG CHUYẾN — mỗi con dấu
 * một cỡ/hình/mực/góc xoay/độ xô riêng (deterministic từ `lib/passport`),
 * chen chúc lấn mép như sổ bị đóng qua nhiều cửa khẩu thật. Đi lại một nơi
 * là THÊM dấu mới — trang dày lên theo năm tháng, không ô nào bị "làm mới".
 *
 * Dấu ghost viền đứt = chuyến còn phía trước (tháng khởi hành + sr-only
 * "next stamp"). Nhãn/tháng là NỘI DUNG thật, các lớp mực là trang trí.
 */

/** Cỡ theo hình — oval bẹt ngang như mộc nhập cảnh, tròn/vuông ba nấc. */
const SHAPE_SIZE: Record<PageStamp['shape'], Record<PageStamp['size'], string>> = {
  round: {
    sm: 'size-[76px] rounded-full',
    md: 'size-[90px] rounded-full',
    lg: 'size-[104px] rounded-full',
  },
  square: {
    sm: 'size-[76px] rounded-2xl',
    md: 'size-[90px] rounded-2xl',
    lg: 'size-[104px] rounded-2xl',
  },
  oval: {
    sm: 'h-[66px] w-[100px] rounded-[50%]',
    md: 'h-[76px] w-[116px] rounded-[50%]',
    lg: 'h-[86px] w-[132px] rounded-[50%]',
  },
};

const INNER_RADIUS: Record<PageStamp['shape'], string> = {
  round: 'rounded-full',
  square: 'rounded-xl',
  oval: 'rounded-[50%]',
};

/** 2–3 màu mực như quầy biên phòng thật — tokens-only. */
const INK_CLASS = [
  'border-ink text-ink',
  'border-success/85 text-success/85',
  'border-foreground/65 text-foreground/65',
];

const DRIFT_CLASS = ['mt-0', 'mt-3', 'mt-6', 'mt-9'];

export function StampPages({ stamps, caption }: { stamps: PageStamp[]; caption?: string }) {
  const t = messages.passportHome;
  return (
    <div>
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card px-4 py-8 md:px-7">
        {/* Nếp gấp giữa của trang sổ mở — chỉ hiện khi đủ rộng. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-12 -translate-x-1/2 bg-linear-to-r from-transparent via-ink/[0.08] to-transparent md:block"
        />
        {/* Số trang in lồng ở góc như trang visa thật. */}
        <span
          aria-hidden="true"
          className="absolute bottom-2 left-4 font-mono text-[9px] tracking-[0.2em] text-ink/30 select-none"
        >
          04
        </span>
        <span
          aria-hidden="true"
          className="absolute right-4 bottom-2 hidden font-mono text-[9px] tracking-[0.2em] text-ink/30 select-none md:block"
        >
          05
        </span>
        <ul className="relative flex flex-wrap items-start gap-x-2 gap-y-5 px-1">
          {stamps.map((s, i) => (
            <li
              key={s.key}
              style={{ transform: `rotate(${s.rotationDeg}deg)` }}
              className={`relative flex flex-none flex-col items-center justify-center border-[2.5px] px-2 text-center ${
                SHAPE_SIZE[s.shape][s.size]
              } ${DRIFT_CLASS[s.driftY] ?? 'mt-0'} ${s.overlap && i > 0 ? '-ml-4' : ''} ${
                s.ghost
                  ? 'border-dashed border-ink/50 text-ink/70'
                  : `stamp-ink opacity-85 ${INK_CLASS[s.ink] ?? INK_CLASS[0]}`
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none absolute inset-[3px] border border-dashed border-current opacity-55 ${INNER_RADIUS[s.shape]}`}
              />
              <span className="px-1 font-heading text-xs leading-tight font-bold tracking-wide">
                {s.label}
              </span>
              <span className="mt-0.5 text-[8.5px] tracking-[0.12em] uppercase">{s.month}</span>
              {s.ghost ? <span className="sr-only">{t.awaitingStamp}</span> : null}
            </li>
          ))}
        </ul>
      </div>
      {caption ? <p className="mt-3 text-xs text-muted-foreground">{caption}</p> : null}
    </div>
  );
}
