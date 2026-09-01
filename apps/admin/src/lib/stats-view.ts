import type {
  AdminBookingsStats,
  AdminCancellationsStats,
  AdminReviewsStats,
  CountMetric,
  DecimalMetric,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { formatAmount } from './bookings-view';

/**
 * Mapper hiển thị hàng stat card (spec P4b §3-F5) — THUẦN, nằm ngoài React
 * nên test được từng nhánh. Card chỉ render VM có sẵn: không có chỗ nào trong
 * JSX tự chia phần trăm hay tự đoán mũi tên.
 *
 * Ranh giới với server, giữ cho chặt: server trả HAI con số của mỗi metric
 * (kỳ này + kỳ liền trước) và độ dài cửa sổ; client chỉ làm ba việc trên hai
 * con số ấy — định dạng, chọn chiều, chọn hướng TỐT/XẤU. Client KHÔNG BAO GIỜ
 * tự cắt một cửa sổ thời gian.
 */

const t = messages.admin.stats;

export type StatDeltaDirection = 'up' | 'down' | 'flat';

export interface StatDelta {
  direction: StatDeltaDirection;
  /** ĐỘ LỚN thay đổi ('33.3%') — chiều nằm ở mũi tên, không lặp lại dấu. */
  percent: string;
  /** Câu đầy đủ cho trình đọc màn hình: mũi tên một mình không thành câu. */
  srLabel: string;
}

/** Một card — hình dạng khớp ĐÚNG props của `StatCard` ở kit. */
export interface StatCardVM {
  key: string;
  label: string;
  value: string;
  caption: string;
  /** Vắng khi không so sánh được (kỳ trước bằng 0, hoặc một trong hai kỳ null). */
  delta?: StatDelta;
  /** Vắng = metric trung tính, pill không tô màu phán quyết nào. */
  deltaGood?: boolean;
}

/**
 * Chiều nào là chiều TỐT của metric. `neutral` cho thông lượng hàng đợi
 * (duyệt/từ chối nhiều hơn vừa là làm việc nhiều hơn vừa là tiền đi ra) — tô
 * màu một chiều ở đó là đặt lời phán quyết vào chỗ không có phán quyết nào.
 */
type StatPolarity = 'up-good' | 'up-bad' | 'neutral';

/** Đếm: có dấu phân cách hàng nghìn ('12,400'). */
const COUNT_FORMATTER = new Intl.NumberFormat('en-US');
const formatCount = (value: number): string => COUNT_FORMATTER.format(value);

/** Tỉ lệ server trả dạng phần trăm 0..100 ('8.3') — chỉ gắn thêm ký hiệu. */
const formatPercent = (value: string): string => `${value}%`;

/** Điểm sao: in NGUYÊN chuỗi server trả (đã 2 chữ số thập phân). */
const formatRating = (value: string): string => value;

/**
 * Pill delta từ hai con số ĐÃ Ở DẠNG SỐ.
 *
 * Trả `undefined` (không có pill) khi `previous` bằng 0: phần trăm thay đổi
 * so với 0 không tồn tại, và "+∞%" hay "+100%" đều là bịa. Thông tin không
 * mất — caption vẫn nói "vs 0 prior 28 days".
 */
function buildDelta(
  current: number,
  previous: number,
  polarity: StatPolarity,
): Pick<StatCardVM, 'delta' | 'deltaGood'> {
  if (previous === 0) return {};

  const direction: StatDeltaDirection =
    current > previous ? 'up' : current < previous ? 'down' : 'flat';
  const percent = `${(Math.abs((current - previous) / previous) * 100).toFixed(1)}%`;
  const srLabel =
    direction === 'up'
      ? t.trend.up(percent)
      : direction === 'down'
        ? t.trend.down(percent)
        : t.trend.flat;

  return {
    delta: { direction, percent, srLabel },
    // Đứng yên thì không có gì tốt hay xấu để tô, cũng như metric trung tính.
    ...(polarity === 'neutral' || direction === 'flat'
      ? {}
      : { deltaGood: polarity === 'up-good' ? direction === 'up' : direction === 'down' }),
  };
}

/** Card của một metric ĐẾM (kỳ này vs kỳ trước, cùng cửa sổ). */
function countCard(
  key: string,
  label: string,
  metric: CountMetric,
  polarity: StatPolarity,
  days: number,
  caption: (previous: string, days: number) => string = t.comparison,
): StatCardVM {
  return {
    key,
    label,
    value: formatCount(metric.current),
    caption: caption(formatCount(metric.previous), days),
    ...buildDelta(metric.current, metric.previous, polarity),
  };
}

/**
 * Card của một metric thập phân CÓ THỂ VẮNG. `null` in ra '—' và cắt luôn
 * pill: một kỳ không tính được thì không có gì để so sánh, và vẽ mũi tên
 * xuống từ "không biết" là nói dối.
 *
 * `Number()` ở đây chỉ để so sánh/độ lớn phần trăm hiển thị — chuỗi thập phân
 * của server vẫn là thứ được IN ra, nên tiền không bao giờ đi qua float.
 */
function decimalCard(
  key: string,
  label: string,
  metric: DecimalMetric,
  polarity: StatPolarity,
  days: number,
  format: (value: string) => string,
): StatCardVM {
  const value = metric.current === null ? t.noValue : format(metric.current);
  const previous = metric.previous === null ? t.noValue : format(metric.previous);
  const comparable = metric.current !== null && metric.previous !== null;

  return {
    key,
    label,
    value,
    caption: t.comparison(previous, days),
    ...(comparable ? buildDelta(Number(metric.current), Number(metric.previous), polarity) : {}),
  };
}

/** Bốn card của `/bookings` — thứ tự theo spec §3-F5. */
export function toBookingsStatCards(stats: AdminBookingsStats): StatCardVM[] {
  const days = stats.period.windowDays;
  const revenue = stats.revenue;

  return [
    {
      key: 'revenue',
      label: t.bookings.revenue,
      // Đồng tiền do SERVER nói đã cộng — client không có hằng số USD nào.
      value: formatAmount(revenue.current, stats.currency),
      caption: t.comparison(formatAmount(revenue.previous, stats.currency), days),
      ...buildDelta(Number(revenue.current), Number(revenue.previous), 'up-good'),
    },
    countCard('paid', t.bookings.paid, stats.paidBookings, 'up-good', days),
    countCard('created', t.bookings.created, stats.newBookings, 'up-good', days),
    // Tỉ lệ huỷ TĂNG là xấu — đây là chỗ duy nhất client "biết" hướng, và nó
    // biết vì đó là ngữ nghĩa của metric, không phải vì tự tính gì.
    decimalCard(
      'cancellationRate',
      t.bookings.cancellationRate,
      stats.cancellationRate,
      'up-bad',
      days,
      formatPercent,
    ),
  ];
}

/** Ba card của `/cancellations`. */
export function toCancellationsStatCards(stats: AdminCancellationsStats): StatCardVM[] {
  const days = stats.period.windowDays;

  return [
    // Hàng đợi là ẢNH CHỤP một mốc, không phải số đếm trong kỳ — caption phải
    // nói đúng chuyện đó ("vs 2 28 days ago").
    countCard(
      'pendingQueue',
      t.cancellations.pendingQueue,
      stats.pendingQueue,
      'up-bad',
      days,
      t.snapshotComparison,
    ),
    countCard('approved', t.cancellations.approved(days), stats.approved, 'neutral', days),
    countCard('denied', t.cancellations.denied(days), stats.denied, 'neutral', days),
  ];
}

/** Ba card của `/reviews`. */
export function toReviewsStatCards(stats: AdminReviewsStats): StatCardVM[] {
  const days = stats.period.windowDays;

  return [
    countCard('pending', t.reviews.pending, stats.pending, 'up-bad', days, t.snapshotComparison),
    // Duyệt được nhiều hơn là hàng đợi được làm — khác cancellations (ở đó
    // "duyệt" là tiền đi ra), nên chỗ này có hướng tốt còn chỗ kia trung tính.
    countCard('approved', t.reviews.approved(days), stats.approved, 'up-good', days),
    decimalCard(
      'averageRating',
      t.reviews.averageRating,
      stats.averageRating,
      'up-good',
      days,
      formatRating,
    ),
  ];
}
