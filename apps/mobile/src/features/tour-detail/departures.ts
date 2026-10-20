import { vietnamToday } from '@tourism/contract';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTHS_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const;
const MONTHS_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

/** Ghế tối thiểu để còn coi là "Almost full" (D3, khớp web `statusAlmostFull`). */
export const ALMOST_FULL_THRESHOLD = 3;

/**
 * `startDate`/`endDate` là ngày lịch (`YYYY-MM-DD`) — tách chuỗi rồi tính thứ
 * bằng `Date.UTC`, KHÔNG `new Date(chuỗi)` trực tiếp: chuỗi date-only bị hiểu
 * là UTC rồi hiển thị theo giờ máy, lệch một ngày ở múi giờ âm (cùng luật
 * `formatDialogDate` bên web, `apps/web/src/lib/tours.ts`).
 */
function dateParts(date: string) {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const dow = DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] as string;
  return { y, m, d, dow };
}

/** "Sat 26 Sep" — thứ + ngày + tháng viết tắt, không năm (D3 bản vẽ 24/09). */
export function formatDepartureDate(date: string): string {
  const p = dateParts(date);
  return `${p.dow} ${p.d} ${MONTHS_SHORT[p.m - 1]}`;
}

/**
 * "Wed 23 – Sat 26 Sep" — chỉ in tháng ở ngày đầu nếu KHÁC tháng ngày cuối
 * (đợt hiếm khi vắt qua tháng, nhưng vẫn phải đọc đúng khi nó xảy ra).
 */
export function formatDepartureRange(startDate: string, endDate: string): string {
  const s = dateParts(startDate);
  const e = dateParts(endDate);
  const startLabel = s.m === e.m ? `${s.dow} ${s.d}` : `${s.dow} ${s.d} ${MONTHS_SHORT[s.m - 1]}`;
  return `${startLabel} – ${e.dow} ${e.d} ${MONTHS_SHORT[e.m - 1]}`;
}

/** "September 2026" — nhãn nhóm tháng của danh sách đợt. */
export function formatDepartureMonth(date: string): string {
  const p = dateParts(date);
  return `${MONTHS_FULL[p.m - 1]} ${p.y}`;
}

/**
 * "21 Sep 2026" — ngày đầy đủ kèm năm, không thứ (chi tiết booking T4/T7/T8:
 * "Paid on"/"Cancelled on", ngày review, ngày đăng bài).
 *
 * Nhận ngày lịch `YYYY-MM-DD` (in nguyên) hoặc mốc thời gian ISO. Mốc thời gian
 * quy về ngày lịch VIỆT NAM trước khi in (ADR-0041 §7, cùng `vietnamDay` của
 * web): cắt 10 ký tự đầu là lấy ngày UTC, nên mốc từ 00:00 tới 07:00 giờ Việt
 * Nam từng in lùi một ngày (M3-10).
 */
export function formatFullDate(date: string): string {
  const day = date.length > 10 ? vietnamToday(new Date(date)) : date;
  const p = dateParts(day);
  return `${p.d} ${MONTHS_SHORT[p.m - 1]} ${p.y}`;
}

/**
 * Đợt CHỌN ĐƯỢC để đặt — port `isDepartureOpen` của web (`apps/web/src/lib/tours.ts`):
 * còn hạn đặt (`bookable`, server tính theo ngày Việt Nam) VÀ còn chỗ. Cờ
 * `bookable` của API KHÔNG xét ghế (doc của `TourDepartureSchema`), nên chỉ
 * đọc mỗi cờ đó thì đợt đã kín vẫn chọn được và vẫn mở được nút "Book now".
 */
export function isDepartureOpen(departure: { bookable: boolean; seatsLeft: number }): boolean {
  return departure.bookable && departure.seatsLeft > 0;
}

/**
 * Giá gạch của một đợt — port `strikePrice` của web (luật user chốt 15/09: chỉ
 * gạch khi có khuyến mãi THẬT). Ứng viên: `basePrice` nếu giá trả thấp hơn nó,
 * và neo riêng của đợt (`anchor` = `compareAtPrice` thô từ API) nếu neo cao hơn
 * giá trả; lấy số cao nhất, không có ứng viên thì không gạch. In thẳng
 * `compareAtPrice` là lệch web ở hai ca: đợt hạ giá không có neo (web gạch giá
 * gốc, app không gạch gì) và neo thấp hơn giá trả (app gạch một số thấp hơn).
 *
 * So bằng `Number()` nhưng trả NGUYÊN chuỗi thập phân thắng cuộc.
 */
export function departureStrikePrice({
  price,
  basePrice,
  anchor,
}: {
  price: string;
  basePrice: string;
  anchor: string | null;
}): string | null {
  const paid = Number(price);
  const candidates: string[] = [];
  if (paid < Number(basePrice)) candidates.push(basePrice);
  if (anchor !== null && Number(anchor) > paid) candidates.push(anchor);
  let strike: string | null = null;
  for (const candidate of candidates) {
    if (strike === null || Number(candidate) > Number(strike)) strike = candidate;
  }
  return strike;
}

export interface RawDeparture {
  id: string;
  startDate: string;
  endDate: string;
  seatsLeft: number;
  effectivePrice: string;
  compareAtPrice: string | null;
  bookable: boolean;
}

export interface DepartureGroup<T> {
  monthLabel: string;
  departures: T[];
}

/**
 * Gom đợt theo tháng của `startDate`, GIỮ NGUYÊN thứ tự API trả (đã sort theo
 * ngày) — nhóm liên tiếp trùng nhãn tháng, không tự sort lại.
 */
export function groupDeparturesByMonth<T extends { startDate: string }>(
  departures: readonly T[],
): DepartureGroup<T>[] {
  const groups: DepartureGroup<T>[] = [];
  for (const departure of departures) {
    const monthLabel = formatDepartureMonth(departure.startDate);
    const last = groups.at(-1);
    if (last?.monthLabel === monthLabel) last.departures.push(departure);
    else groups.push({ monthLabel, departures: [departure] });
  }
  return groups;
}
