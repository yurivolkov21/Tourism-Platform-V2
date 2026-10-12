import { messages } from '@tourism/i18n';
import type { StatusBarView, StatusTone } from '@/lib/report-print';
import { Hatch } from './hatch';

/** Id của ba vân — một thanh trạng thái mỗi trang, ô màu của chú thích dùng lại. */
const HATCH_45 = 'report-print-status-hatch-45';
const HATCH_90 = 'report-print-status-hatch-90';
const HATCH_135 = 'report-print-status-hatch-135';

/** Màu của từng tông (`statusBarView` chốt tông, bộ màu đã qua bộ kiểm dataviz — xem đó). */
const TONE_FILL: Record<StatusTone, string> = {
  gain: 'fill-chart-gain',
  partial: 'fill-chart-3',
  pending: 'fill-pending',
  refunded: 'fill-info',
  cost: 'fill-chart-cost',
};

/**
 * Vân cho bản in trắng đen. Hai trạng thái "tiền ra" mang vân chéo hai hướng. Pending mang vân ngang:
 * độ sáng của nó (OKLCH L 0.531) sát Paid (0.566), in xám hai đoạn đặc trùng màu (đo 12/10). Không
 * dùng vân dọc: khe trắng giữa các đoạn đã là nét dọc, đoạn vân dọc trông như nhiều đoạn nhỏ.
 */
const TONE_HATCH: Partial<Record<StatusTone, string>> = {
  pending: HATCH_90,
  refunded: HATCH_135,
  cost: HATCH_45,
};

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
          <Hatch id={HATCH_90} angle={90} />
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
      {/* Sát thanh, không lề trên: bản thảo khai `.legend { margin-top: 2.4mm }` nhưng `.page ul
          { margin: 0 }` (0,1,1) thắng nó, nên bản được duyệt đặt chú thích ngay dưới thanh. */}
      <ul className="flex flex-wrap gap-x-[6mm] gap-y-[2mm] text-[8.2pt]">
        {view.legend.map((item) => (
          // Nhãn, số, phần trăm là ba ô flex cách 1.6 mm như bản thảo; dấu cách giữa chúng không
          // hiện (flex bỏ chữ trắng) nhưng giữ cho chữ chép ra từ PDF khỏi dính "Paid65(92%)".
          <li key={item.status} className="inline-flex items-center gap-[1.6mm]">
            <Swatch tone={item.tone} />
            <b className="font-semibold">{item.label}</b> <span>{item.count}</span>{' '}
            <span className="text-muted-foreground">({item.share})</span>
          </li>
        ))}
        <li className="ml-auto inline-flex items-center gap-[1.6mm] text-muted-foreground">
          {messages.admin.reports.bookingsTable.total}{' '}
          <b className="font-semibold text-foreground">{view.total}</b>
        </li>
      </ul>
    </div>
  );
}
