/**
 * Luật huỷ và hoàn tiền — NGUỒN DUY NHẤT (ADR-0041).
 *
 * Một hạn chót cho mỗi chuyến, tự tính từ độ dài chuyến, sinh ra CẢ BA thứ:
 *
 * 1. ngày chót in ở trang tour, checkout, email xác nhận và trang booking,
 * 2. gạch đầu dòng ở `/cancellation-policy` và đoạn tương ứng ở `/terms`,
 * 3. số tiền server thật sự hoàn khi khách bấm huỷ.
 *
 * ## Vì sao ở CONTRACT chứ không ở i18n
 *
 * Nó vừa là **copy** vừa là **luật tiền**. Đặt ở `@tourism/i18n` thì API phải
 * import một gói copy để tính tiền — sai tầng, và mở đường cho một sửa đổi
 * "chỉ đổi chữ" âm thầm đổi số tiền trả cho khách. Đặt ở contract thì cả hai
 * đầu đọc chung một bộ hàm, và i18n chỉ lo dịch nó thành câu.
 *
 * Bản trước 15/09 là bảng bậc 100/50/25/0 cộng ân hạn 24 giờ (ADR-0030), cộng
 * badge `freeCancellationDays` nâng ngưỡng theo từng tour (ADR-0023). Cả ba đã
 * gỡ: lý do và cái giá ghi ở ADR-0041 §Hệ quả, không nhắc lại ở đây.
 */

// ── Số học tiền trên chuỗi thập phân — MỘT bản cho cả web, admin và API ──
//
// Tiền đi qua ranh giới dưới dạng CHUỖI thập phân, nên mọi phép cộng trừ phải
// làm trên cent nguyên. Bài học 05/09: web tính bằng float rồi `toFixed(2)`,
// admin làm tròn cent HALF_UP, hai bên lệch một cent trên cùng một booking.
// Từ ADR-0041 luật không còn phép nhân phần trăm, nhưng phép trừ "còn hoàn
// được" vẫn phải là MỘT bản cho web, admin và API — đó là ba hàm dưới đây.

/**
 * Decimal string → số nguyên CENT, làm tròn HALF_UP ở 2dp đúng như
 * `Prisma.Decimal.toDecimalPlaces(2, ROUND_HALF_UP)` phía server. Đi qua chuỗi
 * chứ không qua float: `0.1 + 0.2` của JS là bài học vỡ lòng, và đây là tiền.
 * Chỉ gọi với chuỗi đã qua `DecimalStringSchema` (không dấu, không âm).
 */
export function toCents(value: string): number {
  const [whole = '0', fraction = ''] = value.split('.');
  const cents = Number(`${whole}${`${fraction}00`.slice(0, 2)}`);
  return Number(fraction[2] ?? '0') >= 5 ? cents + 1 : cents;
}

/** Cent → decimal string 2dp, dạng mà contract và sổ cái dùng ('15.50'). */
export function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Phần CÒN HOÀN ĐƯỢC = total − đã hoàn, kẹp sàn 0. */
export function remainingRefundable(totalAmount: string, refundedTotal: string): string {
  return fromCents(Math.max(0, toCents(totalAmount) - toCents(refundedTotal)));
}

// ── Hạn chót một mốc mỗi chuyến (ADR-0041) ──
//
// Nguyên tắc (ADR-0041 §1): chỗ còn bán lại được thì hoàn đủ, không bán lại
// được nữa thì không tự hoàn. Vì thế hạn chót vừa là lúc hết huỷ miễn phí vừa
// là lúc ngừng nhận đặt; API, web, admin, seed và email cùng gọi bộ hàm này.

/** Múi giờ của ngày khởi hành: ngày lịch Việt Nam. */
export const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh';

/** N — số ngày trước ngày khởi hành mà hạn chót rơi vào. */
export type CancellationWindowDays = 1 | 3 | 7;

/** Một dòng của bảng N theo độ dài chuyến. */
export interface CancellationWindowRule {
  /** Độ dài chuyến nhỏ nhất, tính vào. */
  minTripDays: number;
  /** Độ dài chuyến lớn nhất, tính vào; `null` = không giới hạn. */
  maxTripDays: number | null;
  windowDays: CancellationWindowDays;
}

/**
 * N theo độ dài chuyến (spec §3.1): 1 ngày → 1, 2–3 ngày → 3, từ 4 ngày → 7.
 * Nguồn của cả con số server áp lẫn bảng ba dòng ở `/cancellation-policy`.
 *
 * Xếp TĂNG DẦN, dòng sau nối tiếp dòng trước, dòng cuối không trần — test canh
 * bất biến này. Kẹp ở 7 vì bảng bậc cũ vốn coi "dưới 7 ngày" là hết hoàn, nên
 * không tour nào hoàn ít hơn trước (ADR-0041 §2). Không ai cấu hình N.
 */
export const CANCELLATION_WINDOW_RULES: readonly CancellationWindowRule[] = [
  { minTripDays: 1, maxTripDays: 1, windowDays: 1 },
  { minTripDays: 2, maxTripDays: 3, windowDays: 3 },
  { minTripDays: 4, maxTripDays: null, windowDays: 7 },
];

const CALENDAR_DAY_MS = 86_400_000;
const CALENDAR_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * `YYYY-MM-DD` → chỉ số ngày (số ngày kể từ 1970-01-01), đếm thuần trên lịch,
 * không dính giờ máy hay múi giờ.
 *
 * Ngày hỏng NÉM RangeError chứ không trả NaN: NaN làm mọi phép so thành `false`,
 * tức một cột ngày lỗi âm thầm thành "quá hạn, hoàn 0" — cùng bài học của hàm
 * đếm ngày thời bảng bậc (vòng vá review 05/09). Ném thì lỗi thành 500 nhìn thấy
 * được.
 */
function calendarDayIndex(date: string): number {
  const match = CALENDAR_DATE_PATTERN.exec(date);
  if (match === null) throw new RangeError(`Invalid calendar date: ${date}`);
  const [, year, month, day] = match;
  const ms = Date.UTC(Number(year), Number(month) - 1, Number(day));
  // `Date.UTC` tự cuộn ngày không tồn tại (31/02 thành 03/03) — khứ hồi để bắt.
  if (new Date(ms).toISOString().slice(0, 10) !== date) {
    throw new RangeError(`Invalid calendar date: ${date}`);
  }
  return ms / CALENDAR_DAY_MS;
}

/** Chỉ số ngày → `YYYY-MM-DD`; phép ngược của `calendarDayIndex`. */
function calendarDateFromIndex(dayIndex: number): string {
  return new Date(dayIndex * CALENDAR_DAY_MS).toISOString().slice(0, 10);
}

/** N theo độ dài chuyến. RangeError khi `tripDays` không phải số nguyên ≥ 1. */
export function windowDaysForTripLength(tripDays: number): CancellationWindowDays {
  if (!Number.isInteger(tripDays) || tripDays < 1) {
    throw new RangeError(`Invalid trip length: ${tripDays}`);
  }
  const rule = CANCELLATION_WINDOW_RULES.find(
    (entry) =>
      tripDays >= entry.minTripDays &&
      (entry.maxTripDays === null || tripDays <= entry.maxTripDays),
  );
  // Bảng phủ kín mọi độ dài ≥ 1 (có test canh); nhánh này chỉ chạy khi ai đó sửa bảng thành hở.
  if (rule === undefined) {
    throw new RangeError(`No cancellation window for trip length ${tripDays}`);
  }
  return rule.windowDays;
}

/** L = endDate − startDate + 1 (ngày lịch). RangeError khi ngày hỏng hoặc endDate < startDate. */
export function tripLengthDays(startDate: string, endDate: string): number {
  const start = calendarDayIndex(startDate);
  const end = calendarDayIndex(endDate);
  // DB đã có CHECK `departures_date_range` từ P4e-1 (migration 22/09), nhưng
  // guard này GIỮ NGUYÊN: hàm nhận chuỗi từ nhiều nguồn, không phải chỉ từ bảng
  // chuyến — seed, test và bản sao ngày trên `bookings` đều gọi tới. CHECK là
  // lớp dưới, đây là lớp trên.
  if (end < start) {
    throw new RangeError(`Trip ends before it starts: ${startDate} → ${endDate}`);
  }
  return end - start + 1;
}

/** N của một chuyến, tính thẳng từ ngày đi và ngày về. */
export function cancellationWindowDays(startDate: string, endDate: string): CancellationWindowDays {
  return windowDaysForTripLength(tripLengthDays(startDate, endDate));
}

/**
 * D = startDate − N, dạng `YYYY-MM-DD`. Hạn chót hết lúc 23:59:59 giờ Việt Nam
 * của ngày này (spec §3.1), và đó cũng là ngày cuối nhận đặt chỗ (ADR-0041 §3).
 */
export function cancellationDeadline(startDate: string, endDate: string): string {
  return calendarDateFromIndex(
    calendarDayIndex(startDate) - cancellationWindowDays(startDate, endDate),
  );
}

/**
 * Formatter giờ Việt Nam, tạo LƯỜI ở lần gọi đầu chứ không ở module scope: app
 * mobile import contract, và một runtime thiếu dữ liệu múi giờ không được nổ
 * ngay lúc import cả gói.
 */
let vietnamDateFormatter: Intl.DateTimeFormat | undefined;

/** Ngày lịch Việt Nam của `now`, dạng `YYYY-MM-DD`. RangeError khi `now` là Invalid Date. */
export function vietnamToday(now: Date): string {
  if (Number.isNaN(now.getTime())) {
    throw new RangeError('Invalid Date passed to vietnamToday');
  }
  if (vietnamDateFormatter === undefined) {
    vietnamDateFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: VIETNAM_TIME_ZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  }
  // Ghép từ `formatToParts` thay vì tin chuỗi `format()`: thứ tự và dấu nối của
  // khuôn ngày `en-CA` phụ thuộc bản dữ liệu ICU của runtime, còn giá trị từng
  // phần năm/tháng/ngày thì không.
  const parts = vietnamDateFormatter.formatToParts(now);
  const part = (type: 'year' | 'month' | 'day'): string =>
    parts.find((entry) => entry.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

/**
 * Còn trong hạn chót: `vietnamToday(now) <= cancellationDeadline(startDate, endDate)`.
 * Trong hạn thì còn nhận đặt và huỷ còn được hoàn đủ.
 */
export function isWithinDeadline(now: Date, startDate: string, endDate: string): boolean {
  return (
    calendarDayIndex(vietnamToday(now)) <=
    calendarDayIndex(cancellationDeadline(startDate, endDate))
  );
}

/**
 * Còn huỷ online được: `vietnamToday(now) < startDate`, tức tới hết ngày trước
 * ngày khởi hành theo giờ Việt Nam (spec §3.3). Không xét hạn chót — quá hạn vẫn
 * huỷ được, chỉ là không hoàn.
 */
export function canCancelOnline(now: Date, startDate: string): boolean {
  return calendarDayIndex(vietnamToday(now)) < calendarDayIndex(startDate);
}

/**
 * Số tiền hoàn khi khách huỷ (spec §3.3): trong hạn là trọn phần CHƯA hoàn
 * (`remainingRefundable`, tức `total − SUM(refunds)`), quá hạn là `'0.00'`.
 *
 * KHÔNG kiểm `canCancelOnline`: có được huỷ hay không là việc của chỗ gọi (lõi
 * huỷ ở API); hàm này chỉ trả lời "bao nhiêu".
 */
export function refundOnCancel(input: {
  now: Date;
  startDate: string;
  endDate: string;
  totalAmount: string;
  refundedTotal: string;
}): string {
  return isWithinDeadline(input.now, input.startDate, input.endDate)
    ? remainingRefundable(input.totalAmount, input.refundedTotal)
    : '0.00';
}
