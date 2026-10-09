import { messages } from '@tourism/i18n';
import { cn } from '@tourism/ui/lib/utils';
import {
  BanknoteIcon,
  CircleAlertIcon,
  CircleXIcon,
  CreditCardIcon,
  FlagIcon,
  type LucideIcon,
  MapPinIcon,
  RotateCcwIcon,
  TicketIcon,
} from 'lucide-react';
import type { CSSProperties } from 'react';
import type {
  JourneyChip,
  JourneyChipTone,
  JourneyMilestone,
  JourneyView,
  MilestoneKey,
  MilestoneState,
} from '@/lib/booking-journey';

/**
 * Thanh hành trình (spec P7 §2.2, bản vẽ `.jr`) — chỉ VẼ `JourneyView` của
 * `journeyMilestones`; mọi luật nằm ở đó, riêng phép né icon của nhãn Today (tính bằng px) ở đây.
 *
 * MỘT danh sách cho cả hai khổ. Điện thoại: danh sách dọc, dòng Today chen giữa hai mốc đúng
 * chỗ của nó trong DOM (trình đọc màn hình nghe theo cùng thứ tự). Từ `md`: lưới ngang, dòng
 * Today rời khỏi luồng (`absolute`) và đứng trên vạch nối ở vị trí của `todayPosition`.
 *
 * Vạch nối chạy từ tâm cột đầu tới tâm cột cuối: mỗi cột rộng `100 / n`%, tâm cột đầu cách mép
 * `50 / n`% — năm mốc là 10%…90%, đúng `.jr-line` của bản vẽ. Phần vạch đã tô dừng đúng chỗ nhãn
 * Today đứng; không có Today thì tô trọn.
 */
const ICON: Record<MilestoneKey, LucideIcon> = {
  booked: TicketIcon,
  paid: CreditCardIcon,
  freeCancellation: RotateCcwIcon,
  departure: MapPinIcon,
  tripEnds: FlagIcon,
  cancelled: CircleXIcon,
  refund: BanknoteIcon,
  paymentNotCompleted: CircleAlertIcon,
};

const ICON_TONE: Record<MilestoneState, string> = {
  done: 'bg-primary text-primary-foreground',
  now: 'bg-card text-primary-emphasis ring-2 ring-primary',
  next: 'bg-muted text-muted-foreground',
};

/**
 * `warning` là cặp của huy hiệu "Almost full" ở bảng đợt khởi hành (chữ `accent-foreground` trên nền
 * `warning` pha 20%): 7,38:1 theme sáng, 4,98:1 theme tối. `warning-foreground` chỉ dành cho nền
 * `bg-warning` ĐẶC — trên nền pha ở theme tối nó còn 2,14:1, chữ 12px trượt AA (review P7 B24).
 */
const CHIP_TONE: Record<JourneyChipTone, string> = {
  active: 'bg-foreground text-background',
  done: 'border border-success/40 bg-success/10 text-success',
  warning: 'border border-warning/60 bg-warning/20 text-accent-foreground',
  muted: 'bg-muted text-muted-foreground',
};

/** Số cột của lưới ngang theo số mốc (2–5) — viết đủ tên class để Tailwind quét thấy. */
const COLUMNS: Record<number, string> = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  5: 'md:grid-cols-5',
};

/** Làm tròn hai chữ số: phép nhân số thực cho ra `42.99999…%`. */
const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * Khoảng tối thiểu (px) từ TÂM nhãn TODAY tới TÂM icon hai mốc bao quanh, từ `md` (nhãn đứng trên
 * vạch, cùng dải dọc với icon): nửa icon (`size-10` → 20px) + nửa nhãn ("TODAY" Plex Mono 9.5px giãn
 * 0.12em, `px-2` → 50.2px → 25.1px) + ~3px thở. Kẹp theo PX chứ không theo % đoạn: % đoạn co theo
 * bề rộng vạch — 20% đoạn chỉ còn 23px ở 768px, nhãn đè icon 22px (review P7 B21). Đoạn hẹp nhất
 * ở `md` (năm mốc, vạch 578px) dài 115px, đủ cho 2 × 48px.
 */
const TODAY_CLEARANCE_PX = 48;

/** Tâm mốc thứ `index` trên vạch, % bề rộng khung — năm mốc là 10%, 30%, 50%, 70%, 90%. */
function centre(index: number, count: number): number {
  const inset = 50 / count;
  return round2(inset + ((100 - 2 * inset) * index) / (count - 1));
}

/**
 * Chỗ nhãn TODAY đứng trên vạch, dạng biểu thức CSS: tâm theo tỷ lệ ngày (`today.percent` trên khúc
 * giữa tâm mốc đầu và mốc cuối), kẹp cách tâm hai mốc bao quanh (`before − 1` và `before`) ít nhất
 * `TODAY_CLEARANCE_PX`. Phải là `clamp()` của CSS vì bề rộng vạch chỉ có lúc dàn trang.
 */
function todayPosition(today: NonNullable<JourneyView['today']>, count: number): string {
  const inset = 50 / count;
  const at = round2(inset + ((100 - 2 * inset) * today.percent) / 100);
  const from = centre(today.before - 1, count);
  const to = centre(today.before, count);
  return `clamp(calc(${from}% + ${TODAY_CLEARANCE_PX}px), ${at}%, calc(${to}% - ${TODAY_CLEARANCE_PX}px))`;
}

export function TripJourney({ journey }: { journey: JourneyView }) {
  const count = journey.milestones.length;
  const inset = 50 / count;
  const span = 100 - 2 * inset;
  const today = journey.today;
  const todayX = today ? todayPosition(today, count) : null;
  const items = journey.milestones.flatMap((milestone, index) => {
    const mark = todayX && today?.before === index ? [<TodayMark key="today" x={todayX} />] : [];
    return [...mark, <MilestoneItem key={milestone.key} milestone={milestone} />];
  });

  return (
    <section
      aria-labelledby="trip-journey-heading"
      className="rounded-2xl border border-border bg-card px-5 pt-[18px] pb-[22px] sm:px-7"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 id="trip-journey-heading" className="text-[15px] font-semibold">
          {messages.bookingDetail.journey.heading}
        </h2>
        {journey.chip ? <Chip chip={journey.chip} /> : null}
      </div>
      <div data-slot="journey-rail" className="relative mt-4">
        <span
          aria-hidden="true"
          className="absolute top-[19px] hidden h-0.5 bg-muted md:block"
          style={{ left: `${inset}%`, right: `${inset}%` }}
        />
        {/* Bề rộng qua biến CSS: `clamp()` viết thẳng vào `width` inline thì jsdom bỏ đi. */}
        <span
          aria-hidden="true"
          data-slot="journey-fill"
          className="absolute top-[19px] hidden h-0.5 w-(--fill-w) bg-primary md:block"
          style={
            {
              left: `${inset}%`,
              '--fill-w': todayX ? `calc(${todayX} - ${inset}%)` : `${span}%`,
            } as CSSProperties
          }
        />
        <ol
          className={cn(
            'relative flex flex-col gap-3 before:absolute before:top-5 before:bottom-5 before:left-5 before:w-0.5 before:-translate-x-1/2 before:bg-muted md:grid md:gap-0 md:before:hidden',
            COLUMNS[count],
          )}
        >
          {items}
        </ol>
      </div>
    </section>
  );
}

function MilestoneItem({ milestone }: { milestone: JourneyMilestone }) {
  const Icon = ICON[milestone.key];
  return (
    <li
      data-milestone={milestone.key}
      data-state={milestone.state}
      aria-current={milestone.state === 'now' ? 'step' : undefined}
      className="relative z-10 flex items-center gap-3 md:flex-col md:gap-0 md:px-2 md:text-center"
    >
      <span
        className={cn(
          'grid size-10 shrink-0 place-items-center rounded-[11px]',
          ICON_TONE[milestone.state],
        )}
      >
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <span className="flex min-w-0 flex-col">
        <span className="text-[13px] font-semibold md:mt-2">{milestone.label}</span>
        {milestone.detail ? (
          <span className="text-xs text-muted-foreground">{milestone.detail}</span>
        ) : null}
      </span>
    </li>
  );
}

/**
 * Nhãn TODAY (bản vẽ `.jr-today`): điện thoại là một dòng của danh sách, từ `md` nằm đè lên vạch nối
 * ở `x` (`todayPosition`). `x` đi qua biến CSS và chỉ áp từ `md` (`md:left-(--today-x)`) — ở điện
 * thoại phần tử còn `position: static`.
 *
 * Từ `md`, TÂM viên trùng tâm vạch: `top-5` (20px — tâm vạch `top-[19px]` dày 2px, cũng là tâm icon
 * `size-10`) rồi lùi nửa chiều cao của chính nó (`-translate-y-1/2`), nên không phụ thuộc cỡ chữ hay
 * font. Dòng giữ `flex` ở mọi khổ: viên là phần tử flex nên là hộp khối, cao đúng 9.5px chữ + 8px đệm
 * như bản vẽ. Bản trước đổi dòng sang `block` từ `md`, viên thành phần tử inline — hộp nền cao theo
 * font (21px thay vì 17.5px) và ngồi trên đường cơ sở của dòng, tâm lệch 3.5px dưới vạch ở mọi khổ
 * máy bàn (đo 09/10 sau khi user gửi ảnh thử prod).
 */
function TodayMark({ x }: { x: string }) {
  return (
    <li
      data-slot="journey-today"
      style={{ '--today-x': x } as CSSProperties}
      className="flex pl-[52px] md:absolute md:top-5 md:left-(--today-x) md:z-20 md:-translate-x-1/2 md:-translate-y-1/2 md:pl-0"
    >
      <span className="rounded-full bg-foreground px-2 py-1 font-mono text-[9.5px] leading-none font-bold tracking-[0.12em] whitespace-nowrap text-background uppercase">
        {messages.bookingDetail.journey.today}
      </span>
    </li>
  );
}

function Chip({ chip }: { chip: JourneyChip }) {
  return (
    <span
      data-slot="journey-chip"
      data-tone={chip.tone}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-[11px] py-1.5 text-xs leading-none font-semibold whitespace-nowrap',
        CHIP_TONE[chip.tone],
      )}
    >
      {chip.tone === 'done' ? (
        <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />
      ) : null}
      {chip.label}
    </span>
  );
}
