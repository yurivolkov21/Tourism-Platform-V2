import {
  type AdminBookingsStats,
  type AdminCancellationsStats,
  type AdminEnquiriesStats,
  type AdminOutboxStats,
  type AdminPaymentEventsStats,
  type AdminReviewsStats,
  type AdminSubscribersStats,
  type CountMetric,
  type DecimalMetric,
  OPEN_ENQUIRY_STATUSES,
  PAYMENT_EVENT_STUCK_MINUTES,
  type StatsPeriod,
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

/**
 * Ngày trong nhãn khoảng. UTC là BẮT BUỘC chứ không phải mặc định tuỳ tiện:
 * mốc `2026-09-01T00:00:00Z` đọc theo giờ máy ở múi âm sẽ lùi thành 31/08, và
 * nhãn phải khớp cột `Created` của bảng ngay dưới — cùng thước đo với sổ
 * audit của API (xem `stats-math.ts`), không phải đồng hồ người đang xem.
 */
const DAY_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
const YEAR_FORMAT = new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: 'UTC' });

const DAY_MS = 86_400_000;

/**
 * Nhãn khoảng ngày cho một kỳ `[fromIso, toIso)` — 'Sep 1 – Sep 30, 2026'.
 *
 * `toIso` là mốc chặn KHÔNG tính vào (biên nửa-mở của cả module — ADR-0028
 * §3), nên nhãn lùi một ngày để in ngày CUỐI CÙNG thật sự nằm trong kỳ. In
 * thẳng `toIso` là nói dối đúng một ngày ở mọi khoảng.
 *
 * Năm viết MỘT lần ở cuối khi hai đầu cùng năm, và viết đủ hai lần khi kỳ vắt
 * qua giao thừa: lọc tháng 1 thì kỳ trước rơi vào tháng 12 năm ngoái, và một
 * nhãn 'Dec 2 – Jan 1' không nói ra điều đó là nhãn đánh đố.
 *
 * TIỀN ĐIỀU KIỆN: hai mốc phải đọc được. `Intl.format` của một `Invalid Date`
 * ném `RangeError`, nên đừng gọi thẳng hàm này với dữ liệu dây — cổng kiểm là
 * `isPickedPeriod`, và nó canh cả ba mốc.
 */
export function statsRangeLabel(fromIso: string, toIso: string): string {
  const from = new Date(fromIso);
  // Ngày cuối TÍNH VÀO = mốc chặn lùi một ngày.
  const to = new Date(Date.parse(toIso) - DAY_MS);
  const fromYear = YEAR_FORMAT.format(from);
  const toYear = YEAR_FORMAT.format(to);

  return fromYear === toYear
    ? `${DAY_FORMAT.format(from)} – ${DAY_FORMAT.format(to)}, ${toYear}`
    : `${DAY_FORMAT.format(from)}, ${fromYear} – ${DAY_FORMAT.format(to)}, ${toYear}`;
}

/** Mốc ISO đọc được thành một thời điểm thật hay không. */
const isInstant = (iso: string | undefined): boolean => !Number.isNaN(Date.parse(iso ?? ''));

/**
 * Kỳ này có phải do ADMIN chọn không.
 *
 * Dấu hiệu là `currentTo !== generatedAt`: cửa sổ TRƯỢT kết đúng lúc chốt sổ
 * (xem `statsWindow` bên API), còn kỳ đã chọn thì cuối kỳ là một mốc lịch
 * đứng yên. Client KHÔNG tự cắt cửa sổ nào — nó chỉ đọc hai mốc server trả.
 *
 * Kiểm CẢ BA mốc đọc được không, chứ không chỉ so hai chuỗi. Lý do là lệch
 * phiên bản lúc deploy (ADR-0024): Vercel dựng xong admin trước khi Render
 * dựng xong API, nên vài phút liền bản admin MỚI đứng cạnh bản API CŨ — bản
 * chưa biết `currentTo`. Client oRPC KHÔNG validate response theo output
 * schema, nên một field thiếu đi thẳng tới đây và `Intl.format` của một
 * `Invalid Date` ném `RangeError`, làm 500 nguyên trang `/bookings`.
 *
 * Ngả về "không phải kỳ đã chọn" là hành vi TRƯỚC ADR-0028: caption "prior N
 * days", không có dòng khoảng ngày. Vẫn đúng, chỉ là kém cụ thể hơn — đúng
 * thứ một trang admin nên làm khi phía dưới nó vừa lùi một phiên bản.
 *
 * Ba mốc chứ không một: `previousFrom`/`currentFrom` mới là cặp caption đọc,
 * nên kiểm mỗi `currentTo` thì lỗi chỉ dời xuống một dòng.
 */
function isPickedPeriod(period: StatsPeriod): boolean {
  return (
    isInstant(period.currentTo) &&
    isInstant(period.currentFrom) &&
    isInstant(period.previousFrom) &&
    period.currentTo !== period.generatedAt
  );
}

/**
 * Dòng khoảng ngày cho CẢ hàng card. `undefined` khi cửa sổ đang trượt: in
 * một ngày cụ thể ở đó sẽ cũ đi từng phút, còn "28 ngày gần nhất" thì bốn
 * caption đã nói rồi.
 */
export function statsPeriodLabel(period: StatsPeriod): string | undefined {
  return isPickedPeriod(period)
    ? t.periodLabel(statsRangeLabel(period.currentFrom, period.currentTo))
    : undefined;
}

/**
 * Câu caption so sánh của MỘT bộ số. Kỳ trượt giữ "prior N days"; kỳ đã chọn
 * in thẳng khoảng ngày của kỳ TRƯỚC — `[previousFrom, currentFrom)`.
 *
 * Trả về một hàm cùng chữ ký `t.comparison` để `countCard`/`decimalCard`
 * không phải biết chuyện này: chúng nhận một câu, không nhận một chế độ.
 */
function comparisonCaption(period: StatsPeriod): (previous: string, days: number) => string {
  if (!isPickedPeriod(period)) return t.comparison;
  const range = statsRangeLabel(period.previousFrom, period.currentFrom);
  return (previous) => t.comparisonRange(previous, range);
}

/**
 * Caption của metric ẢNH CHỤP. Con số so sánh là số của MỘT MỐC (đầu kỳ), nên
 * kỳ trượt nói "N days ago" còn kỳ đã chọn nói thẳng tên ngày — kỳ đứng yên
 * thì gọi được tên nó (ADR-0028 §AMEND).
 */
function snapshotCaption(period: StatsPeriod): (previous: string, days: number) => string {
  if (!isPickedPeriod(period)) return t.snapshotComparison;
  const at = statsInstantLabel(period.currentFrom);
  return (previous) => t.snapshotComparisonAt(previous, at);
}

/** Nhãn MỘT mốc ('May 1, 2026') — cho caption của card ảnh chụp. */
function statsInstantLabel(iso: string): string {
  const at = new Date(iso);
  return `${DAY_FORMAT.format(at)}, ${YEAR_FORMAT.format(at)}`;
}

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
  caption: (previous: string, days: number) => string = t.comparison,
): StatCardVM {
  const value = metric.current === null ? t.noValue : format(metric.current);
  const previous = metric.previous === null ? t.noValue : format(metric.previous);
  const comparable = metric.current !== null && metric.previous !== null;

  return {
    key,
    label,
    value,
    caption: caption(previous, days),
    ...(comparable
      ? buildDelta(Number(metric.current), Number(metric.previous), polarity, display)
      : {}),
  };
}

/** Bốn card của `/bookings` — thứ tự theo spec §3-F5. */
export function toBookingsStatCards(stats: AdminBookingsStats): StatCardVM[] {
  const days = stats.period.windowDays;
  const revenue = stats.revenue;
  // Vùng DUY NHẤT có bộ lọc ngày (ADR-0028), nên cũng là vùng duy nhất có hai
  // chế độ caption. Dựng MỘT lần cho cả bốn card: bốn lần gọi là bốn lần
  // format cùng một khoảng.
  const caption = comparisonCaption(stats.period);

  return [
    {
      key: 'revenue',
      label: t.bookings.revenue,
      // Đồng tiền do SERVER nói đã cộng — client không có hằng số USD nào.
      value: formatAmount(revenue.current, stats.currency),
      caption: caption(formatAmount(revenue.previous, stats.currency), days),
      ...buildDelta(Number(revenue.current), Number(revenue.previous), 'up-good'),
    },
    countCard('paid', t.bookings.paid, stats.paidBookings, 'up-good', days, caption),
    countCard('created', t.bookings.created, stats.newBookings, 'up-good', days, caption),
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
      caption,
    ),
  ];
}

/** Ba card của `/cancellations`. */
export function toCancellationsStatCards(stats: AdminCancellationsStats): StatCardVM[] {
  const days = stats.period.windowDays;
  const picked = isPickedPeriod(stats.period);
  const caption = comparisonCaption(stats.period);

  return [
    // Hàng đợi là ẢNH CHỤP một mốc, không phải số đếm trong kỳ — caption phải
    // nói đúng chuyện đó ("vs 2 28 days ago", hoặc "vs 12 on May 1, 2026" khi
    // kỳ do admin chọn).
    countCard(
      'pendingQueue',
      t.cancellations.pendingQueue,
      stats.pendingQueue,
      'up-bad',
      days,
      snapshotCaption(stats.period),
    ),
    // Nhãn BỎ hậu tố "Nd" khi kỳ do admin chọn: "Approved 31d" đọc thành "31
    // ngày gần nhất", tức một cửa sổ trượt — nhưng lọc tháng 5 là một kỳ đứng
    // yên, và dòng khoảng ngày trên hàng card đã nói rõ kỳ nào.
    countCard(
      'approved',
      picked ? t.cancellations.approvedInPeriod : t.cancellations.approved(days),
      stats.approved,
      'neutral',
      days,
      caption,
    ),
    countCard(
      'denied',
      picked ? t.cancellations.deniedInPeriod : t.cancellations.denied(days),
      stats.denied,
      'neutral',
      days,
      caption,
    ),
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

/**
 * Ba card của `/subscribers` (spec P4c §3-F10). Đây là hàng card DUY NHẤT có
 * hai polarity ĐỐI LẬP cạnh nhau: `created` up-good (danh sách lớn lên là
 * tốt) và `unsubscribed` up-BAD — cùng một mũi tên đi lên, một cái xanh một
 * cái đỏ. Cố ý, vì đó đúng là ý nghĩa của hai con số; để `unsubscribed`
 * trung tính sẽ đọc thành "rời danh sách nhiều hơn cũng chẳng sao".
 *
 * `active` là ảnh chụp KHÔNG có callout đỏ — khác `outbox.failed`: đây là con
 * số người ta MUỐN thấy lớn, không phải một hàng đợi chờ người xử lý. Dùng
 * `snapshotCard` cho caption đổi theo 0/khác-0, bỏ tham số callout.
 */
export function toSubscribersStatCards(stats: AdminSubscribersStats): StatCardVM[] {
  const days = stats.period.windowDays;

  return [
    countCard('created', t.subscribers.created(days), stats.created, 'up-good', days),
    countCard('unsubscribed', t.subscribers.unsubscribed(days), stats.unsubscribed, 'up-bad', days),
    snapshotCard('active', t.subscribers.active, stats.active, {
      some: t.subscribers.activeCaption,
      none: t.subscribers.activeCaptionNone,
    }),
  ];
}
