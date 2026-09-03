import {
  type AdminBookingsStats,
  type AdminCancellationsStats,
  type AdminEnquiriesStats,
  type AdminOutboxStats,
  type AdminPaymentEventsStats,
  type AdminReviewsStats,
  type CountMetric,
  type DecimalMetric,
  OPEN_ENQUIRY_STATUSES,
  PAYMENT_EVENT_STUCK_MINUTES,
} from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { formatAmount } from './bookings-view';
import { enquiryStatusLabel } from './enquiries-view';

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
  /**
   * Pill trạng thái cho card ẢNH CHỤP (không có kỳ trước nên không có
   * `delta`): nhãn + tông. Kit render `data-testid="stat-callout"`, khác hẳn
   * pill delta — vòng vá review F7, thay cho mẹo mượn `direction: 'flat'`.
   */
  callout?: { label: string; srLabel?: string; tone: 'good' | 'bad' | 'neutral' };
}

/**
 * Chiều nào là chiều TỐT của metric. `neutral` cho thông lượng hàng đợi
 * (duyệt/từ chối nhiều hơn vừa là làm việc nhiều hơn vừa là tiền đi ra) — tô
 * màu một chiều ở đó là đặt lời phán quyết vào chỗ không có phán quyết nào.
 */
type StatPolarity = 'up-good' | 'up-bad' | 'neutral';

/** Đếm: có dấu phân cách hàng nghìn ('12,400'). EXPORT vì `reports-view.ts`
 *  dùng chung — hai bề mặt số liệu phải đếm bằng một bộ định dạng (vòng vá
 *  review F6: bản chép bên reports từng có thể trôi lệch mà không test nào đỏ). */
const COUNT_FORMATTER = new Intl.NumberFormat('en-US');
export const formatCount = (value: number): string => COUNT_FORMATTER.format(value);

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

/**
 * Card ẢNH CHỤP (số đơn, không delta) có thể mang CALLOUT — pill đỏ dạng
 * "lời gọi người", không phải xu hướng; kit có khe riêng (`callout`) nên
 * không mượn `delta`. Gộp ở vòng vá review F8: card Failed của outbox và
 * Unprocessed của payment events từng chép nguyên khối này.
 *
 * `callout.when` tách khỏi `count` có chủ đích: payment events kêu đỏ theo
 * số row KẸT chứ không theo mọi row chưa xong (xem `toPaymentEventsStatCards`).
 */
function snapshotCard(
  key: string,
  label: string,
  count: number,
  caption: { some: string; none: string },
  callout?: { when: boolean; label: string; srLabel: string },
): StatCardVM {
  return {
    key,
    label,
    value: formatCount(count),
    caption: count > 0 ? caption.some : caption.none,
    ...(callout?.when
      ? { callout: { label: callout.label, srLabel: callout.srLabel, tone: 'bad' as const } }
      : {}),
  };
}

/**
 * Ba card của `/outbox` (spec P4c §3-F7). Cả ba là số ĐƠN, không card nào có
 * pill delta (vòng vá review F7): `sent` không có kỳ trước vì purge 30 ngày
 * xoá gần hết kỳ 28–56 ngày (một cặp ở đây là "↑1200%" bịa mỗi ngày);
 * `queued`/`failed` là ảnh chụp. Caption nói thẳng con số đo gì thay vì
 * "vs …".
 */
export function toOutboxStatCards(stats: AdminOutboxStats): StatCardVM[] {
  const days = stats.period.windowDays;

  return [
    {
      key: 'sent',
      label: t.outbox.sent(days),
      value: formatCount(stats.sent),
      caption: t.outbox.sentCaption(days),
    },
    {
      key: 'queued',
      label: t.outbox.queued,
      value: formatCount(stats.queued),
      caption: t.outbox.queuedCaption,
    },
    // Failed > 0 là lời gọi NGƯỜI (chỉ admin retry mới đưa hàng rời FAILED).
    snapshotCard(
      'failed',
      t.outbox.failed,
      stats.failed,
      { some: t.outbox.failedCaption, none: t.outbox.failedCaptionNone },
      {
        when: stats.failed > 0,
        label: t.outbox.needsAttention,
        srLabel: t.outbox.needsAttentionSr(formatCount(stats.failed)),
      },
    ),
  ];
}

/**
 * Ba card của `/payment-events` (spec P4c §3-F8). `received`/`linked` là cặp
 * hai kỳ theo receivedAt — TRUNG TÍNH cả hai: nhiều webhook hơn chỉ là nhiều
 * lượt thanh toán/echo hơn, không có phán quyết tốt/xấu. `unprocessed` là
 * ảnh chụp: số đơn khớp bảng; callout đỏ CHỈ khi có row KẸT (`stuck` — chưa
 * xong quá `PAYMENT_EVENT_STUCK_MINUTES` phút, vòng vá review F8): row vừa
 * tới mà handler đang chạy là chuyện bình thường, kêu đỏ với nó là card
 * "khóc sói" mỗi lần có người thanh toán.
 */
export function toPaymentEventsStatCards(stats: AdminPaymentEventsStats): StatCardVM[] {
  const days = stats.period.windowDays;
  const stuck = formatCount(stats.stuck);

  return [
    countCard('received', t.paymentEvents.received(days), stats.received, 'neutral', days),
    snapshotCard(
      'unprocessed',
      t.paymentEvents.unprocessed,
      stats.unprocessed,
      {
        some:
          stats.stuck > 0
            ? t.paymentEvents.stuckCaption(stuck, PAYMENT_EVENT_STUCK_MINUTES)
            : t.paymentEvents.unprocessedCaption,
        none: t.paymentEvents.unprocessedCaptionNone,
      },
      {
        when: stats.stuck > 0,
        label: t.paymentEvents.needsAttention,
        srLabel: t.paymentEvents.needsAttentionSr(stuck, PAYMENT_EVENT_STUCK_MINUTES),
      },
    ),
    countCard('linked', t.paymentEvents.linked(days), stats.linked, 'neutral', days),
  ];
}

/**
 * Ba card của `/enquiries` (spec P4c §3-F9). `created`/`won` là cặp hai kỳ và
 * CÓ hướng: lead mới đổ vào nhiều hơn là nhu cầu tốt hơn, lượt thắng nhiều
 * hơn là bán được nhiều hơn — khác `received`/`linked` của payment events
 * (thông lượng webhook không có chiều tốt/xấu).
 *
 * `open` là ảnh chụp KHÔNG có callout đỏ — khác `outbox.failed`: hàng chờ CRM
 * là trạng thái bình thường của một đường bán hàng đang sống (0 lead đang mở
 * còn đáng lo hơn 20), trong khi một row FAILED chỉ rời trạng thái đó khi có
 * người can thiệp. Dùng `snapshotCard` cho caption đổi theo 0/khác-0, bỏ
 * tham số callout.
 */
export function toEnquiriesStatCards(stats: AdminEnquiriesStats): StatCardVM[] {
  const days = stats.period.windowDays;

  return [
    countCard('created', t.enquiries.created(days), stats.created, 'up-good', days),
    countCard('won', t.enquiries.won(days), stats.won, 'up-good', days),
    snapshotCard('open', t.enquiries.open, stats.open, {
      // Danh sách trạng thái mở dựng từ HẰNG contract (vòng vá review F9) —
      // thêm một trạng thái mở là caption tự đúng, không kể tay ở i18n.
      some: t.enquiries.openCaption(OPEN_ENQUIRY_STATUSES.map(enquiryStatusLabel).join(', ')),
      none: t.enquiries.openCaptionNone,
    }),
  ];
}
