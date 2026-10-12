import type { WaterfallView } from '@/lib/report-print';
import { Hatch } from './hatch';

/** Id của vân 45° — một thác nước mỗi trang (tờ in báo cáo), nên id cố định là đủ. */
const HATCH_ID = 'report-print-waterfall-hatch';

/**
 * Viền chữ màu giấy quanh nhãn số: vạch lưới hay trục 0 đi ngang qua nhãn thì bị cắt quanh chữ thay
 * vì gạch ngang chữ (lãi ròng sát 0 đặt nhãn cột phí ngay trên trục).
 */
const HALO = { paintOrder: 'stroke', strokeWidth: 3, strokeLinejoin: 'round' } as const;

/**
 * Thác nước "From revenue to net profit" của bản in C2 (spec §5.2) — SVG tĩnh vẽ từ hình học đã
 * tính ở `waterfallView`; component không tính gì. Màu bằng token: cột tổng `chart-gain`, cột trừ và
 * cột tổng âm `chart-cost` kèm vân 45° (in trắng đen vẫn tách, spec §2.4). Bảng lãi lỗ cạnh bên là
 * bản "table view" của biểu đồ (dataviz).
 */
export function Waterfall({ view }: { view: WaterfallView }) {
  const [gridFrom, gridTo] = view.gridX;
  return (
    <svg
      data-slot="waterfall"
      viewBox={`0 0 ${view.width} ${view.height}`}
      role="img"
      aria-label={view.label}
      className="block h-auto w-full"
    >
      <defs>
        <Hatch id={HATCH_ID} angle={45} />
      </defs>

      {view.grid.map((line) => (
        <g key={line.label} data-slot="waterfall-grid" data-base={line.base ? '' : undefined}>
          <line
            x1={gridFrom}
            x2={gridTo}
            y1={line.y}
            y2={line.y}
            className={line.base ? 'stroke-foreground' : 'stroke-border'}
            strokeWidth={line.base ? 1 : 0.8}
          />
          <text
            x={gridTo}
            y={line.y - 3}
            textAnchor="end"
            className="fill-muted-foreground stroke-card font-mono text-[9px] font-medium"
            {...HALO}
          >
            {line.label}
          </text>
        </g>
      ))}

      {view.connectors.map((connector) => (
        <line
          key={`${connector.x1}-${connector.y}`}
          x1={connector.x1}
          x2={connector.x2}
          y1={connector.y}
          y2={connector.y}
          className="stroke-muted-foreground/60"
          strokeWidth={0.8}
          strokeDasharray="2 2"
        />
      ))}

      {view.bars.map((bar) => (
        <g key={bar.key} data-slot="waterfall-bar" data-key={bar.key} data-tone={bar.tone}>
          <path
            d={bar.path}
            className={bar.tone === 'gain' ? 'fill-chart-gain' : 'fill-chart-cost'}
          />
          {bar.tone === 'cost' ? <path d={bar.path} fill={`url(#${HATCH_ID})`} /> : null}
          <text
            x={bar.label.x}
            y={bar.label.y}
            textAnchor="middle"
            className="fill-foreground stroke-card font-sans text-[11px] font-semibold"
            {...HALO}
          >
            {bar.label.text}
          </text>
          {bar.category.lines.map((line, i) => (
            <text
              key={line}
              x={bar.category.x}
              y={view.categoryY[i]}
              textAnchor="middle"
              className="fill-foreground/85 font-sans text-[9.5px] font-medium"
            >
              {line}
            </text>
          ))}
        </g>
      ))}
    </svg>
  );
}
