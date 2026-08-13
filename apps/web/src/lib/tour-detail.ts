import { departureStatus } from './tours';

/** Trần thumb: 7×64 + 6×8 = 496 ≤ 541 (cạnh ảnh vuông). Ô thứ 8 thành 568 > 541. */
export const GALLERY_THUMB_SLOTS = 7;
/** Số ô ngày ở panel; phần còn lại đi qua modal "All dates". */
export const DEPARTURE_CHIP_SLOTS = 4;

export function galleryThumbs<T>(media: readonly T[], slots = GALLERY_THUMB_SLOTS) {
  return { thumbs: media.slice(0, slots), hiddenCount: Math.max(0, media.length - slots) };
}

export function visibleDepartureChips<T extends { id: string; seatsLeft: number }>(
  departures: readonly T[],
  selectedId: string | null,
  slots = DEPARTURE_CHIP_SLOTS,
): T[] {
  const open = departures.filter((d) => d.seatsLeft > 0);
  const head = open.slice(0, slots);
  if (head.some((d) => d.id === selectedId)) return head;
  const picked = open.find((d) => d.id === selectedId);
  // Đợt đang chọn phải LUÔN nhìn thấy, nếu không panel và nút Reserve nói khác nhau.
  return picked ? [...head.slice(0, slots - 1), picked] : head;
}

export function itineraryDayDate(startDate: string, dayNumber: number): Date {
  const d = new Date(`${startDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dayNumber - 1);
  return d;
}

/** So theo NGÀY LỊCH UTC — cùng quy ước với `checkReviewEligibility` phía API. */
function dayKey(d: Date): number {
  return d.getUTCFullYear() * 10000 + d.getUTCMonth() * 100 + d.getUTCDate();
}

export function itineraryDayState(
  dayDate: Date,
  today: Date,
  live: boolean,
): 'preview' | 'done' | 'active' | 'upcoming' {
  // `live` = session có booking PAID ở đúng đợt này. Không có nó thì mọi ngày
  // đều "preview": không tick, không spinner, không làm mờ — làm mờ cả 4 ngày
  // của một chuyến tương lai khiến trang trông như hỏng.
  if (!live) return 'preview';
  const a = dayKey(dayDate),
    b = dayKey(today);
  return a < b ? 'done' : a === b ? 'active' : 'upcoming';
}

export function departureMonths<
  T extends { startDate: string; seatsLeft: number; effectivePrice: string },
>(departures: readonly T[]) {
  const out: {
    month: string;
    items: T[];
    seatsLeft: number;
    minPrice: number;
    maxPrice: number;
  }[] = [];
  for (const d of departures) {
    const month = d.startDate.slice(0, 7);
    let bucket = out.find((m) => m.month === month);
    if (!bucket) {
      bucket = { month, items: [], seatsLeft: 0, minPrice: Infinity, maxPrice: 0 };
      out.push(bucket);
    }
    const price = Number(d.effectivePrice);
    bucket.items.push(d);
    bucket.seatsLeft += d.seatsLeft;
    bucket.minPrice = Math.min(bucket.minPrice, price);
    bucket.maxPrice = Math.max(bucket.maxPrice, price);
  }
  return out;
}

/**
 * Số dòng đợt hiện ra khi xổ một tháng; phần dư nhường cho modal "All dates".
 *
 * Vì sao phải chặn: bảng nhóm theo tháng nên một tour chạy tuyến hằng ngày có
 * thể có 30 đợt trong một tháng. Xổ hết ra là ba card chính sách bị đẩy khỏi
 * màn hình và tab Departures biến thành một danh sách vô tận — trong khi modal
 * "All dates" (đã dựng ở R2) sinh ra đúng để chứa danh sách dài.
 */
export const DEPARTURE_ROWS_PER_MONTH = 6;

export type MonthNotice =
  | { kind: 'sold-out' }
  | { kind: 'some-sold-out'; count: number }
  | { kind: 'limited' }
  | null;

/**
 * Huy hiệu cấp tháng — lấy trạng thái GẮT NHẤT trong tháng, và im lặng khi
 * không có gì đáng nói.
 *
 * Hai luật đắt giá ở đây, cả hai đều là lỗi đã đo được trên wireframe:
 *
 * 1. Không lấy trạng thái gộp. Tháng 8 có đúng một đợt còn 2 chỗ mà gắn nhãn
 *    "All open" là **nói sai** — dòng cha hứa rộng rãi trong khi dòng con duy
 *    nhất của nó đang "Almost full".
 * 2. Trả `null` khi mọi đợt đều rộng chỗ. Bốn viên huy hiệu xanh giống hệt
 *    nhau xếp dọc không truyền tin gì, chỉ làm nhiễu cột.
 */
export function monthNotice(items: readonly { seatsLeft: number }[]): MonthNotice {
  if (items.length === 0) return null;
  const soldOut = items.filter((d) => d.seatsLeft <= 0).length;
  if (soldOut === items.length) return { kind: 'sold-out' };
  if (soldOut > 0) return { kind: 'some-sold-out', count: soldOut };
  // Ngưỡng "sắp hết" đi qua `departureStatus` để bảng và ô ngày dùng chung
  // đúng một con số — đổi ngưỡng ở đó là đổi cả hai nơi.
  const fewest = Math.min(...items.map((d) => d.seatsLeft));
  return departureStatus(fewest) === 'limited' ? { kind: 'limited' } : null;
}

/**
 * Dải ngày của một tháng cho dòng cha: `"20 Aug"` hoặc `"1–29 Oct"`.
 *
 * Lấy MIN/MAX chứ không lấy phần tử đầu/cuối mảng: API trả theo `startDate asc`
 * nhưng hàm này cũng được gọi từ test và từ dữ liệu đã lọc, nên không dựa vào
 * thứ tự đầu vào. Cùng luật timezone với `formatDateRange`: tách chuỗi
 * `YYYY-MM-DD`, KHÔNG qua `new Date()`.
 */
export function monthDateSpan(items: readonly { startDate: string }[]): string {
  const days = items.map((d) => Number(d.startDate.slice(8, 10)));
  const [, m] = (items[0]?.startDate ?? '').split('-').map(Number) as [number, number];
  const month = SPAN_MONTHS[m - 1] ?? '';
  const lo = Math.min(...days);
  const hi = Math.max(...days);
  return lo === hi ? `${lo} ${month}` : `${lo}–${hi} ${month}`;
}

const SPAN_MONTHS = [
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
];

/**
 * Tháng mở sẵn khi vào tab: tháng chứa đợt đang chọn ở panel đặt chỗ.
 *
 * Nếu bảng mở một tháng khác với đợt panel đang chọn thì hai chỗ trên cùng một
 * màn hình đang nói hai chuyện. Chưa chọn gì (mọi đợt đều hết chỗ nên provider
 * để `undefined`) thì lùi về tháng đầu tiên CÒN CHỖ — mở sẵn một tháng đã bán
 * hết là dẫn khách vào ngõ cụt ngay dòng đầu.
 */
export function defaultOpenMonth(
  months: readonly { month: string; items: readonly { id: string; seatsLeft: number }[] }[],
  selectedId: string | undefined,
): string | undefined {
  const picked = months.find((m) => m.items.some((d) => d.id === selectedId));
  if (picked) return picked.month;
  return (months.find((m) => m.items.some((d) => d.seatsLeft > 0)) ?? months[0])?.month;
}

export function ratingHistogram(breakdown: Record<string, number>) {
  const total = Object.values(breakdown).reduce((s, n) => s + n, 0);
  return [5, 4, 3, 2, 1].map((star) => {
    const count = breakdown[String(star)] ?? 0;
    return { star, count, percent: total === 0 ? 0 : (count / total) * 100 };
  });
}

/**
 * Tách `TourItineraryDay.description` thành các mốc trong ngày.
 *
 * Fixture viết mỗi dòng theo khuôn `HH:MM — việc` (xem
 * `apps/api/prisma/fixtures/catalog/tours-*.ts`). Đây là parse một ĐỊNH DẠNG
 * người soạn nội dung tuân theo, không phải đoán ngữ nghĩa từ từ khoá — nên
 * an toàn, và có đường lùi rõ ràng: dòng không khớp khuôn vẫn hiện đủ chữ,
 * chỉ là không có cột giờ.
 *
 * Chỉ cắt ở dấu phân cách ĐẦU TIÊN: phần việc có thể chứa dấu gạch dài của
 * chính nó ("Boat option — paid on the day").
 */
export function parseItineraryStops(
  description: string | null,
): { time: string | null; text: string }[] {
  if (!description) return [];
  return description
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const match = /^(\d{1,2}:\d{2})\s*[—–-]\s*(.+)$/.exec(line);
      return match?.[1] && match[2]
        ? { time: match[1], text: match[2].trim() }
        : { time: null, text: line };
    });
}

/**
 * `"2026-09"` (khoá tháng của `departureMonths`) → `"September 2026"`.
 *
 * `timeZone: 'UTC'` BẮT BUỘC: không có nó, `Intl` diễn giải mốc theo giờ máy
 * chạy và có thể lùi một tháng ở múi giờ ÂM — cùng bẫy mà `formatDateRange`
 * (`lib/tours.ts`) đã né bằng cách tách chuỗi thay vì `new Date(dateOnlyString)`.
 */
const MONTH_LABEL_FMT = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

export function monthLabel(month: string): string {
  const [year, m] = month.split('-').map(Number) as [number, number];
  return MONTH_LABEL_FMT.format(new Date(Date.UTC(year, m - 1, 1)));
}

/**
 * Nhãn mùa của một tháng, SUY từ khoảng giá tháng đó so với `basePrice`.
 *
 * Không có field "mùa" nào trong contract — giá đợt (`priceOverride`) là dấu
 * hiệu duy nhất, và nó là dấu hiệu thật: người vận hành hạ giá tháng vắng và
 * nâng giá tháng cao điểm.
 *
 * Tháng lệch cả hai đầu (có đợt rẻ hơn VÀ đợt đắt hơn) đọc là **thấp mùa**: giá
 * vào rẻ nhất là con số khách quyết định theo. Bằng giá gốc thì không gắn nhãn —
 * nhãn xuất hiện ở mọi tháng là nhãn không nói gì.
 */
export function monthSeason(
  minPrice: number,
  maxPrice: number,
  basePrice: number,
): 'low' | 'peak' | null {
  if (minPrice < basePrice) return 'low';
  if (maxPrice > basePrice) return 'peak';
  return null;
}
