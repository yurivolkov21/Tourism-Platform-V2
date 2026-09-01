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
  /** ĐỘ LỚN thay đổi KÈM đơn vị ('33.3%', '2.0 pp', '0.23', 'New') — chiều
   *  nằm ở mũi tên, không lặp lại dấu. */
  amount: string;
  /** Câu đầy đủ cho trình đọc màn hình: mũi tên một mình không thành câu. */
  srLabel: string;
}

/**
 * Cách in độ lớn delta — theo ĐƠN VỊ của metric (vòng vá review F5):
 * - `relative`: % thay đổi tương đối — cho đếm và tiền ("doanh thu ↑33.3%").
 * - `percentage-points`: hiệu số ĐIỂM phần trăm — cho metric vốn LÀ phần
 *   trăm. "Cancellation rate 4.0% ↑100.0%" đọc thành tăng gấp đôi/chạm trần;
 *   sự thật là "+2.0 pp".
 * - `points`: hiệu số thô — cho thang chặn hai đầu (sao 1..5), nơi % trên
 *   thang gần như vô nghĩa.
 */
type DeltaDisplay = 'relative' | 'percentage-points' | 'points';

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

/** Tô màu phán quyết theo polarity — đứng yên/trung tính thì không tô gì. */
function toneOf(
  direction: StatDeltaDirection,
  polarity: StatPolarity,
): Pick<StatCardVM, 'deltaGood'> {
  return polarity === 'neutral' || direction === 'flat'
    ? {}
    : { deltaGood: polarity === 'up-good' ? direction === 'up' : direction === 'down' };
}

/**
 * Pill delta từ hai con số ĐÃ Ở DẠNG SỐ.
 *
 * `previous === 0` không có % tương đối ("+∞%" là bịa), nhưng KHÔNG được im
 * lặng (vòng vá review F5): hàng đợi 0 → 40 là chuyển động đáng báo nhất của
 * trang mà bản đầu render y hệt 40 → 40. Nay: 0 → N dương hiện pill "New"
 * (kèm tô màu theo polarity); 0 → 0 mới thật sự không có gì để nói.
 */
function buildDelta(
  current: number,
  previous: number,
  polarity: StatPolarity,
  display: DeltaDisplay = 'relative',
): Pick<StatCardVM, 'delta' | 'deltaGood'> {
  if (previous === 0) {
    if (current === 0) return {};
    return {
      delta: { direction: 'up', amount: t.trend.newLabel, srLabel: t.trend.fromZero },
      ...toneOf('up', polarity),
    };
  }

  const direction: StatDeltaDirection =
    current > previous ? 'up' : current < previous ? 'down' : 'flat';
  const diff = Math.abs(current - previous);
  const amount =
    display === 'relative'
      ? `${((diff / previous) * 100).toFixed(1)}%`
      : display === 'percentage-points'
        ? t.trend.percentagePoints(diff.toFixed(1))
        : diff.toFixed(2);
  const srLabel =
    direction === 'up'
      ? t.trend.up(amount)
      : direction === 'down'
        ? t.trend.down(amount)
        : t.trend.flat;

  return { delta: { direction, amount, srLabel }, ...toneOf(direction, polarity) };
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
  display: DeltaDisplay,
): StatCardVM {
  const value = metric.current === null ? t.noValue : format(metric.current);
  const previous = metric.previous === null ? t.noValue : format(metric.previous);
  const comparable = metric.current !== null && metric.previous !== null;

  return {
    key,
    label,
    value,
    caption: t.comparison(previous, days),
    ...(comparable
      ? buildDelta(Number(metric.current), Number(metric.previous), polarity, display)
      : {}),
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
      // Metric VỐN là % → delta theo điểm phần trăm, không phải % của %.
      'percentage-points',
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
      // Thang sao chặn hai đầu → delta là hiệu số thô (0.23), không phải %.
      'points',
    ),
  ];
}
