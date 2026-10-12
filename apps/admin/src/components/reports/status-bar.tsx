import { messages } from '@tourism/i18n';
import type { StatusBarView, StatusTone } from '@/lib/report-print';

/** Id của hai vân — một thanh trạng thái mỗi trang, ô màu của chú thích dùng lại. */
const HATCH_45 = 'report-print-status-hatch-45';
const HATCH_135 = 'report-print-status-hatch-135';

/** Màu của từng tông (`statusBarView` chốt tông, bộ màu đã qua bộ kiểm dataviz — xem đó). */
const TONE_FILL: Record<StatusTone, string> = {
  gain: 'fill-chart-gain',
  partial: 'fill-chart-3',
  pending: 'fill-pending',
  refunded: 'fill-info',
  cost: 'fill-chart-cost',
};

/** Hai trạng thái "tiền ra" mang vân, hai hướng khác nhau — in trắng đen vẫn tách được. */
const TONE_HATCH: Partial<Record<StatusTone, string>> = {
  refunded: HATCH_135,
  cost: HATCH_45,
};

function Hatch({ id, angle }: { id: string; angle: number }) {
  return (
    <pattern
      id={id}
      width={5}
      height={5}
      patternUnits="userSpaceOnUse"
      patternTransform={`rotate(${angle})`}
    >
      <line
        x1={0}
        y1={0}
        x2={0}
        y2={5}
        className="stroke-card"
        strokeOpacity={0.55}
        strokeWidth={1.6}
      />
    </pattern>
  );
}

/** Ô màu của chú thích — cùng màu, cùng vân với đoạn trên thanh. */
function Swatch({ tone }: { tone: StatusTone }) {
  const hatch = TONE_HATCH[tone];
  return (
    <svg viewBox="0 0 10 10" aria-hidden="true" className="size-[3mm] shrink-0">
      <rect width={10} height={10} rx={2.3} className={TONE_FILL[tone]} />
      {hatch ? <rect width={10} height={10} rx={2.3} fill={`url(#${hatch})`} /> : null}
    </svg>
  );
}

/**
 * Thanh 100% "Bookings created this month" của bản in C2 và chú thích (spec §5.1 mục 6): nhãn · số ·
 * %, cuối hàng là tổng. Thanh `aria-hidden` — chú thích là chữ thật mang đủ thông tin.
 */
export function StatusBar({ view }: { view: StatusBarView }) {
  return (
    <div data-slot="status-bar">
      <svg
        viewBox="0 0 600 16"
        preserveAspectRatio="none"
        aria-hidden="true"
        className="mt-[1mm] block h-[4.2mm] w-full"
      >
        <defs>
          <Hatch id={HATCH_45} angle={45} />
          <Hatch id={HATCH_135} angle={135} />
        </defs>
        {view.segments.map((segment) => {
          const rx = Math.min(3, segment.width / 2);
          const hatch = TONE_HATCH[segment.tone];
          return (
            <g key={segment.status} data-status={segment.status} data-tone={segment.tone}>
              <rect
                x={segment.x}
                width={segment.width}
                height={16}
                rx={rx}
                className={TONE_FILL[segment.tone]}
              />
              {hatch ? (
                <rect
                  x={segment.x}
                  width={segment.width}
                  height={16}
                  rx={rx}
                  fill={`url(#${hatch})`}
                />
              ) : null}
            </g>
          );
        })}
      </svg>
      <ul className="mt-[2.4mm] flex flex-wrap gap-x-[6mm] gap-y-[2mm] text-[8.2pt]">
        {view.legend.map((item) => (
          <li key={item.status} className="inline-flex items-center gap-[1.6mm]">
            <Swatch tone={item.tone} />
            <span>
              <b className="font-semibold">{item.label}</b> {item.count}{' '}
              <span className="text-muted-foreground">({item.share})</span>
            </span>
          </li>
        ))}
        <li className="ml-auto text-muted-foreground">
          {messages.admin.reports.bookingsTable.total}{' '}
          <b className="font-semibold text-foreground">{view.total}</b>
        </li>
      </ul>
    </div>
  );
}
