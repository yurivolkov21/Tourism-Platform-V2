import type { AdminMonthlyReport, BookingStatusValue } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { formatAmount, formatDateTime, statusLabel } from './bookings-view';
import { formatMonthLabel } from './month-options';
import {
  costWarning,
  formatMarginPct,
  reportBookingsTotal,
  reportPeriodLabel,
  toReportPnlRows,
  toReportSummaryRows,
} from './reports-view';
import { formatCount } from './stats-view';

/**
 * Bản in báo cáo tháng C2 (G40 Phần 2, spec 2026-10-10 §5, ADR-0057) — view-model THUẦN.
 *
 * Mọi chữ, số và hình học của tờ in nằm ở đây để test được: toạ độ SVG của thác nước (viewBox
 * 480 × 236, khung của bản thảo `print-report.src.html`), các đoạn của thanh trạng thái (600 × 16).
 * Component chỉ vẽ.
 *
 * Số hiển thị lấy từ CHÍNH chuỗi thập phân của API (`formatAmount`, `accountingAmount`). `Number()`
 * chỉ dùng cho hình học — chiều cao một cột lệch một phần tỉ đơn vị không ai thấy, một con số in
 * lệch một xu thì có.
 */

const t = messages.admin.reports;

/** Dấu trừ thật (U+2212) của nhãn ngắn, như bản thảo — gạch nối ASCII trông như dấu gạch. */
const MINUS = '\u2212';

// ── Định dạng tiền ──────────────────────────────────────────────────────────

const PREFIXES = new Map<string, string>();

/**
 * Tiền tố của nhãn ngắn: "$" cho USD, "€" cho EUR. Ký hiệu là chữ (mã Intl không có ký hiệu riêng,
 * hay chính mã khi Intl từ chối nó) thì cách số một khoảng: "CHF 1.5k", không "CHF1.5k".
 */
function moneyPrefix(currency: string): string {
  const cached = PREFIXES.get(currency);
  if (cached !== undefined) return cached;
  let symbol = currency;
  try {
    symbol =
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
      })
        .formatToParts(0)
        .find((part) => part.type === 'currency')?.value ?? currency;
  } catch {
    // Contract chỉ ép `length(3)`, không ép ISO-4217 — mã sai thì in chính mã, cùng lối
    // `formatAmount`: in thô còn hơn nổ giữa lúc render.
  }
  const prefix = /\p{L}$/u.test(symbol) ? `${symbol} ` : symbol;
  PREFIXES.set(currency, prefix);
  return prefix;
}

/**
 * Nhãn ngắn ở đầu cột thác nước: "$992", "$39.6k", "−$25.7k", "$1.2M" (spec §5.2).
 *
 * Làm tròn đồng TRƯỚC rồi mới chọn đơn vị (999.5 → "$1.0k", không "$1000"), và làm tròn phần lẻ
 * bằng số nguyên (`Math.round(whole / 100) / 10`): `(1.15).toFixed(1)` của float ra "1.1".
 */
export function shortMoney(value: number, currency: string): string {
  const whole = Math.round(Math.abs(value));
  let body: string;
  if (whole < 1000) body = String(whole);
  else if (whole < 999_950) body = `${(Math.round(whole / 100) / 10).toFixed(1)}k`;
  else body = `${(Math.round(whole / 100_000) / 10).toFixed(1)}M`;
  // Không có "−$0": số tròn ra 0 là 0.
  const sign = value < 0 && whole > 0 ? MINUS : '';
  return `${sign}${moneyPrefix(currency)}${body}`;
}

/** Nhãn vạch lưới: vạch là số tròn nên bỏ đuôi ".0" — "$0", "$20k", "$2.5k". */
export function axisMoney(value: number, currency: string): string {
  const abs = Math.abs(value);
  const trim = (n: number) => String(Number(n.toFixed(2)));
  let body: string;
  if (abs < 1000) body = trim(abs);
  else if (abs < 1_000_000) body = `${trim(abs / 1000)}k`;
  else body = `${trim(abs / 1_000_000)}M`;
  return `${value < 0 ? MINUS : ''}${moneyPrefix(currency)}${body}`;
}

const ACCOUNTING = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Số của bảng lãi lỗ theo lối kế toán của bản thảo: hai số lẻ, nhóm nghìn, số âm trong ngoặc, không
 * ký hiệu tiền (dòng kỳ đã nói đơn vị). `negate` cho dòng chi phí — API trả chi phí là số dương,
 * bảng in nó là số âm `(25,737.54)`.
 *
 * `Intl` định dạng THẲNG chuỗi thập phân (NumberFormat v3), không đi qua float.
 */
export function accountingAmount(amount: string, { negate = false } = {}): string {
  const magnitude = amount.replace(/^-/, '');
  const text = ACCOUNTING.format(magnitude as `${number}`);
  const zero = /^0*\.?0*$/.test(magnitude);
  return amount.startsWith('-') !== negate && !zero ? `(${text})` : text;
}

// ── Vạch lưới ───────────────────────────────────────────────────────────────

/** Bước "đẹp": 1, 2, 2.5, 5 × 10^k. */
const NICE_STEPS = [1, 2, 2.5, 5] as const;
/** Số vạch muốn có, kể cả vạch 0 — bản thảo có ba: 0, 20k, 40k. */
const TARGET_LINES = 3;
/** Vạch ngoài cùng được vượt miền số tối đa 2% (vạch 40k với đỉnh 39.6k của bản thảo). */
const OVERSHOOT = 1.02;

function ticksOf(step: number, lo: number, hi: number): number[] {
  const from = Math.ceil((lo * OVERSHOOT) / step - 1e-9);
  const to = Math.floor((hi * OVERSHOOT) / step + 1e-9);
  const ticks: number[] = [];
  // `toPrecision` gỡ rác float (3 × 0.1); `+ 0` đổi −0 thành 0.
  for (let i = from; i <= to; i++) ticks.push(Number((i * step).toPrecision(12)) + 0);
  return ticks;
}

/**
 * Vạch lưới ngang của thác nước, tăng dần, luôn có 0 (miền luôn chứa 0). Chọn bước cho số vạch gần
 * `TARGET_LINES` nhất; hoà thì bước nhỏ hơn (thêm một vạch để đọc hơn là bớt).
 */
export function niceTicks(lo: number, hi: number): number[] {
  const span = hi - lo;
  if (!(span > 0)) return [0];
  const exp = Math.floor(Math.log10(span));
  let best: number[] = [0];
  let bestScore = Number.POSITIVE_INFINITY;
  // Bước tăng dần, so sánh nghiêm: hoà thì bước nhỏ (gặp trước) thắng.
  for (let k = exp - 2; k <= exp + 1; k++) {
    for (const nice of NICE_STEPS) {
      const ticks = ticksOf(nice * 10 ** k, lo, hi);
      const score = Math.abs(ticks.length - TARGET_LINES);
      if (score < bestScore) {
        best = ticks;
        bestScore = score;
      }
    }
  }
  return best;
}

// ── Thác nước ───────────────────────────────────────────────────────────────

export type WaterfallKey =
  | 'recognizedRevenue'
  | 'cogsVariable'
  | 'cogsFixed'
  | 'grossProfit'
  | 'taxAmount'
  | 'paymentFees'
  | 'netProfit';

export interface WaterfallBar {
  key: WaterfallKey;
  /** `total` đứng trên trục 0; `down` treo từ mức đang chạy. */
  kind: 'total' | 'down';
  /** `gain` → `chart-gain`; `cost` → `chart-cost` kèm vân 45°. */
  tone: 'gain' | 'cost';
  x: number;
  width: number;
  /** Hai mép trên, dưới của cột (đơn vị viewBox, y đi xuống), đã nới tới cao tối thiểu. */
  top: number;
  bottom: number;
  /** `d` của path: đầu dữ liệu bo, chân vuông. */
  path: string;
  label: { x: number; y: number; text: string };
  category: { x: number; lines: readonly [string, string] };
}

export interface WaterfallView {
  width: number;
  height: number;
  bars: readonly WaterfallBar[];
  connectors: readonly { x1: number; x2: number; y: number }[];
  /** Vạch lưới tăng dần theo giá trị; `base` là trục 0 (nét mực). */
  grid: readonly { y: number; label: string; base: boolean }[];
  /** Hai đầu của vạch lưới; nhãn trục canh phải ở đầu sau. */
  gridX: readonly [number, number];
  /** Hai chân chữ của nhãn hạng mục dưới trục. */
  categoryY: readonly [number, number];
  /** `aria-label` của SVG. */
  label: string;
}

/** Khung của bản thảo C2: viewBox 480 × 236, lề trên 20, dưới 42, trái và phải 6. */
const WF = { width: 480, height: 236, top: 20, bottom: 42, left: 6, right: 6 } as const;
/**
 * Lề phải dành cho nhãn trục (bản thảo không có: nhãn trục đặt ở mép phải, nằm trên dải của cột lãi
 * ròng, nên đè lên nhãn cột ấy khi lãi ròng gần một vạch lưới). 30 đơn vị chứa vừa "−$10k" mono 9px.
 */
const AXIS_GUTTER = 30;
/** Đáy vùng vẽ — trục 0 khi không có số âm. */
const PLOT_BOTTOM = WF.height - WF.bottom;
const BAR_MAX_WIDTH = 46;
const BAR_SHARE = 0.62;
const BAR_RADIUS = 4;
/** Cột bằng 0 vẫn phải thấy được (dataviz: không mất một dấu). */
const MIN_BAR = 1.5;
/** Khoảng từ đầu cột tới chân chữ: nhãn trên (chữ 11px) và nhãn dưới. */
const LABEL_ABOVE = 5;
const LABEL_BELOW = 11;
/**
 * Chân chữ thấp nhất cho nhãn dưới cột: dòng nhãn hạng mục đầu tiên có chân ở `PLOT_BOTTOM + 15`,
 * đỉnh chữ 9.5px của nó ở khoảng `PLOT_BOTTOM + 8`; chừa thêm cho phần chữ dưới chân.
 */
const LABEL_FLOOR = PLOT_BOTTOM + 4;
const CATEGORY_Y = [PLOT_BOTTOM + 15, PLOT_BOTTOM + 26] as const;

const STEPS: readonly { key: WaterfallKey; kind: 'total' | 'down' }[] = [
  { key: 'recognizedRevenue', kind: 'total' },
  { key: 'cogsVariable', kind: 'down' },
  { key: 'cogsFixed', kind: 'down' },
  { key: 'grossProfit', kind: 'total' },
  { key: 'taxAmount', kind: 'down' },
  { key: 'paymentFees', kind: 'down' },
  { key: 'netProfit', kind: 'total' },
];

/** Hai số lẻ cho chuỗi `d` — đủ mịn ở khổ in (một đơn vị viewBox chừng 0.23 mm). */
const coord = (value: number) => value.toFixed(2);

/** Path của một cột: đầu dữ liệu (`end`) bo `min(4, h/2)`, đầu kia vuông. */
function barPath(x: number, width: number, top: number, bottom: number, end: 'top' | 'bottom') {
  const r = Math.min(BAR_RADIUS, (bottom - top) / 2, width / 2);
  const left = x;
  const right = x + width;
  if (end === 'top') {
    return (
      `M${coord(left)} ${coord(bottom)}V${coord(top + r)}` +
      `Q${coord(left)} ${coord(top)} ${coord(left + r)} ${coord(top)}H${coord(right - r)}` +
      `Q${coord(right)} ${coord(top)} ${coord(right)} ${coord(top + r)}V${coord(bottom)}Z`
    );
  }
  return (
    `M${coord(left)} ${coord(top)}H${coord(right)}V${coord(bottom - r)}` +
    `Q${coord(right)} ${coord(bottom)} ${coord(right - r)} ${coord(bottom)}H${coord(left + r)}` +
    `Q${coord(left)} ${coord(bottom)} ${coord(left)} ${coord(bottom - r)}Z`
  );
}

/**
 * Hình học thác nước "From revenue to net profit" (spec §5.2), hay `null` khi cả bảy giá trị bằng 0
 * (tháng chưa bắt đầu, chưa chuyến nào kết thúc) — tờ in thay biểu đồ bằng `printDoc.noFigures`.
 *
 * Ba luật thêm vào thuật toán của bản thảo, vì bản thảo chỉ vẽ một tháng lãi:
 * - miền `[min(0, mọi mức), max(0, mọi mức)]`: tháng lỗ có cột dưới trục 0;
 * - tỉ lệ co lại khi một nhãn dưới cột (cột trừ, cột tổng âm) sẽ chạm hàng nhãn hạng mục — tính
 *   đóng dạng từ điểm thấp nhất có nhãn dưới, không thử dần;
 * - lề phải `AXIS_GUTTER` cho nhãn trục.
 */
export function waterfallView(report: AdminMonthlyReport): WaterfallView | null {
  const values: Record<WaterfallKey, number> = {
    recognizedRevenue: Number(report.recognizedRevenue),
    cogsVariable: Number(report.cogsVariable),
    cogsFixed: Number(report.cogsFixed),
    grossProfit: Number(report.grossProfit),
    taxAmount: Number(report.taxAmount),
    paymentFees: Number(report.paymentFees),
    netProfit: Number(report.netProfit),
  };
  if (Object.values(values).every((value) => value === 0)) return null;

  // Đi qua bảy bước: cột tổng từ 0 tới chính nó; cột trừ từ mức đang chạy xuống. Cột tổng lấy số
  // của API (không cộng lại), nên lãi gộp và lãi ròng in đúng con số trên bảng bên cạnh.
  let level = 0;
  const spans = STEPS.map(({ key, kind }) => {
    const value = values[key];
    const from = kind === 'total' ? 0 : level;
    const to = kind === 'total' ? value : level - value;
    level = to;
    return { key, kind, value, high: Math.max(from, to), low: Math.min(from, to), after: to };
  });

  const lo = Math.min(0, ...spans.map((span) => span.low));
  const hi = Math.max(0, ...spans.map((span) => span.high));
  // Đầu dữ liệu ở đỉnh chỉ với cột tổng không âm; mọi cột khác mang nhãn DƯỚI đáy.
  const endsAtTop = (span: (typeof spans)[number]) => span.kind === 'total' && span.value >= 0;
  let scale = (PLOT_BOTTOM - WF.top) / (hi - lo);
  for (const span of spans) {
    if (endsAtTop(span) || hi - span.low <= 0) continue;
    const room = LABEL_FLOOR - LABEL_BELOW - MIN_BAR - WF.top;
    scale = Math.min(scale, room / (hi - span.low));
  }
  const y = (value: number) => WF.top + (hi - value) * scale;

  const band = (WF.width - WF.left - WF.right - AXIS_GUTTER) / STEPS.length;
  const width = Math.min(BAR_MAX_WIDTH, band * BAR_SHARE);
  const bars = spans.map((span, i): WaterfallBar => {
    const center = WF.left + band * (i + 0.5);
    const x = center - width / 2;
    const atTop = endsAtTop(span);
    let top = y(span.high);
    let bottom = y(span.low);
    if (bottom - top < MIN_BAR) {
      // Nới về phía đầu dữ liệu: chân vẫn bám trục (cột tổng) hay mức đang chạy (cột trừ).
      if (atTop) top = bottom - MIN_BAR;
      else bottom = top + MIN_BAR;
    }
    const shown = span.kind === 'down' ? -span.value : span.value;
    return {
      key: span.key,
      kind: span.kind,
      tone: span.kind === 'down' || span.value < 0 ? 'cost' : 'gain',
      x,
      width,
      top,
      bottom,
      path: barPath(x, width, top, bottom, atTop ? 'top' : 'bottom'),
      label: {
        x: center,
        y: atTop ? top - LABEL_ABOVE : bottom + LABEL_BELOW,
        text: shortMoney(shown, report.currency),
      },
      category: { x: center, lines: t.printDoc.waterfall[span.key] },
    };
  });

  const connectors = bars.slice(0, -1).map((bar, i) => ({
    x1: bar.x + bar.width,
    x2: bars[i + 1]?.x ?? bar.x + bar.width,
    y: y(spans[i]?.after ?? 0),
  }));

  return {
    width: WF.width,
    height: WF.height,
    bars,
    connectors,
    grid: niceTicks(lo, hi).map((value) => ({
      y: y(value),
      label: axisMoney(value, report.currency),
      base: value === 0,
    })),
    gridX: [WF.left, WF.width - WF.right],
    categoryY: CATEGORY_Y,
    label: t.printDoc.waterfallLabel(formatMonthLabel(report.month)),
  };
}

// ── Thanh trạng thái ────────────────────────────────────────────────────────

/**
 * Tông của từng trạng thái — màu ở component: `gain` → `chart-gain`, `partial` → `chart-3`,
 * `pending` → `pending`, `refunded` → `info` kèm vân 135°, `cost` → `chart-cost` kèm vân 45°.
 * Bộ năm màu đã qua `validate_palette.js` của skill dataviz (light, trên `card`): tách màu khi mù
 * màu xấu nhất 15.0, mắt thường 20.1, tương phản ≥ 3:1. Vân giữ hai trạng thái "tiền ra" tách khi in
 * trắng đen; chú thích luôn có chữ.
 */
export type StatusTone = 'gain' | 'partial' | 'pending' | 'refunded' | 'cost';

/** Thứ tự cố định trên thanh: đơn đã thu tiền trước, đơn huỷ cuối — không theo thứ tự của API. */
const STATUS_ORDER: readonly BookingStatusValue[] = [
  'PAID',
  'PARTIALLY_REFUNDED',
  'PENDING',
  'REFUNDED',
  'CANCELLED',
];

const STATUS_TONE: Record<BookingStatusValue, StatusTone> = {
  PAID: 'gain',
  PARTIALLY_REFUNDED: 'partial',
  PENDING: 'pending',
  REFUNDED: 'refunded',
  CANCELLED: 'cost',
};

/** viewBox 600 × 16 của bản thảo, giãn ngang theo khổ; khe 2 giữa hai đoạn (dataviz). */
const STATUS_BAR = { width: 600, gap: 2 } as const;

export interface StatusBarView {
  segments: readonly { status: BookingStatusValue; tone: StatusTone; x: number; width: number }[];
  legend: readonly {
    status: BookingStatusValue;
    tone: StatusTone;
    label: string;
    count: string;
    share: string;
  }[];
  /** Tổng của server (`newBookings`), cùng bộ định dạng với bảng màn hình. */
  total: string;
}

/** Phần trăm số nguyên của chú thích; khác 0 mà tròn ra 0 là "<1%", chưa đủ mà tròn ra 100 là ">99%". */
function sharePct(count: number, total: number): string {
  const pct = Math.round((count / total) * 100);
  if (pct === 0) return '<1%';
  if (pct === 100 && count < total) return '>99%';
  return `${pct}%`;
}

/**
 * Thanh 100% "Bookings created this month" và chú thích của nó, hay `null` khi tháng không tạo
 * booking nào (tờ in thay bằng `bookingsTable.empty`). Chỉ trạng thái có số khác 0 lên thanh và chú
 * thích — bảng trên màn hình vẫn đủ năm hàng.
 */
export function statusBarView(report: AdminMonthlyReport): StatusBarView | null {
  const counts = new Map(report.bookingsByStatus.map(({ status, count }) => [status, count]));
  const present = STATUS_ORDER.map((status) => ({ status, count: counts.get(status) ?? 0 })).filter(
    ({ count }) => count > 0,
  );
  // Tổng này chỉ để chia hình; con số in ra là `newBookings` của server.
  const sum = present.reduce((acc, { count }) => acc + count, 0);
  if (sum === 0) return null;

  const room = STATUS_BAR.width - STATUS_BAR.gap * (present.length - 1);
  let x = 0;
  const segments = present.map(({ status, count }) => {
    const width = (count / sum) * room;
    const segment = { status, tone: STATUS_TONE[status], x, width };
    x += width + STATUS_BAR.gap;
    return segment;
  });

  return {
    segments,
    legend: present.map(({ status, count }) => ({
      status,
      tone: STATUS_TONE[status],
      label: statusLabel(status),
      count: formatCount(count),
      share: sharePct(count, sum),
    })),
    total: reportBookingsTotal(report),
  };
}

// ── Cả tờ ───────────────────────────────────────────────────────────────────

export interface ReportPrintTile {
  key: 'recognizedRevenue' | 'grossProfit' | 'netProfit' | 'revenue';
  label: string;
  value: string;
  caption: string;
  /** Ô đầu nền `paper` (bản thảo C2). */
  hero: boolean;
  /** Chuỗi dài (từ "$1,000,000.00"): hạ cỡ chữ cho khỏi tràn ô. */
  long: boolean;
}

export interface ReportPrintPnlRow {
  key: PnlKey;
  label: string;
  value: string;
  /** Thành phần của phép trừ ngay trên — thụt vào. */
  indent: boolean;
  /** `sub`: gạch trên, chữ đậm (tổng phụ); `net`: gạch trên, gạch kép dưới (lãi ròng). */
  rule: 'none' | 'sub' | 'net';
}

export interface ReportPrintView {
  /** Số tài liệu của đầu trang: kỳ `YYYY-MM`. */
  docNumber: string;
  /** "Generated 10 Oct 2026, 02:30 UTC". */
  meta: string;
  title: string;
  periodLine: string;
  tiles: readonly ReportPrintTile[];
  waterfall: WaterfallView | null;
  pnl: readonly ReportPrintPnlRow[];
  /** "15 departures ran this month" — mẫu số của giá vốn theo chuyến. */
  departuresNote: string;
  costWarning: string | null;
  statusBar: StatusBarView | null;
  ops: readonly { key: string; label: string; value: string }[];
  definitions: readonly string[];
  /** Vế giữa chân trang: "Monthly report 2026-09". */
  footerRef: string;
}

const PNL_KEYS = [
  'recognizedRevenue',
  'cogsVariable',
  'cogsFixed',
  'cogsTotal',
  'grossProfit',
  'taxAmount',
  'paymentFees',
  'netProfit',
] as const;
type PnlKey = (typeof PNL_KEYS)[number];
const isPnlKey = (key: string): key is PnlKey => (PNL_KEYS as readonly string[]).includes(key);

/** Dòng chi phí: API trả số dương, bảng kế toán in số âm. */
const COST_ROWS: ReadonlySet<PnlKey> = new Set([
  'cogsVariable',
  'cogsFixed',
  'cogsTotal',
  'taxAmount',
  'paymentFees',
]);

/** Từ "$1,000,000.00" (13 ký tự) trở lên thì ô 15 pt không chứa nổi. */
const LONG_TILE = 12;

/** Thứ tự chú giải của sheet Definitions trong file Excel (G40 Phần 3): giấy và file đọc như nhau. */
const DEFINITION_ORDER = [
  'revenue',
  'recognised',
  'costs',
  'netProfit',
  'refunds',
  'statuses',
  'cancellations',
] as const satisfies readonly (keyof typeof t.definitions)[];

/** Toàn bộ chữ, số và hình của tờ C2 — `ReportPrint` chỉ việc vẽ. */
export function reportPrintView(report: AdminMonthlyReport): ReportPrintView {
  const money = (amount: string) => formatAmount(amount, report.currency);
  const c = t.cards;
  const tiles: Omit<ReportPrintTile, 'long'>[] = [
    {
      key: 'recognizedRevenue',
      label: c.recognizedRevenue,
      value: money(report.recognizedRevenue),
      caption: c.recognizedCaption,
      hero: true,
    },
    {
      key: 'grossProfit',
      label: c.grossProfit,
      value: money(report.grossProfit),
      caption: c.marginCaption(formatMarginPct(report.grossMarginPct)),
      hero: false,
    },
    {
      key: 'netProfit',
      label: c.netProfit,
      value: money(report.netProfit),
      caption: c.netCaption,
      hero: false,
    },
    {
      key: 'revenue',
      label: c.revenue,
      value: money(report.revenue),
      caption: c.paidCaption(formatCount(report.paidBookings)),
      hero: false,
    },
  ];

  // Khoá, nhãn (có thuế suất), thụt và đậm lấy từ bảng màn hình — một nguồn cho thứ tự dòng.
  const pnl = toReportPnlRows(report).map((row): ReportPrintPnlRow => {
    if (!isPnlKey(row.key)) throw new Error(`Dòng lãi lỗ không có trong báo cáo: ${row.key}`);
    return {
      key: row.key,
      label: row.label,
      value: accountingAmount(report[row.key], { negate: COST_ROWS.has(row.key) }),
      indent: row.indent === true,
      rule: row.key === 'netProfit' ? 'net' : row.emphasis ? 'sub' : 'none',
    };
  });

  return {
    docNumber: report.month,
    meta: t.generatedAt(formatDateTime(report.generatedAt)),
    title: t.reportTitle(formatMonthLabel(report.month)),
    periodLine: t.periodLine(
      reportPeriodLabel(report),
      report.currency,
      formatMarginPct(report.taxRate),
    ),
    tiles: tiles.map((tile) => ({ ...tile, long: tile.value.length > LONG_TILE })),
    waterfall: waterfallView(report),
    pnl,
    departuresNote: t.pnlTable.departuresRun(formatCount(report.departuresRun)),
    costWarning: costWarning(report),
    statusBar: statusBarView(report),
    ops: toReportSummaryRows(report),
    definitions: DEFINITION_ORDER.map((key) => t.definitions[key]),
    footerRef: t.printDoc.docRef(report.month),
  };
}
