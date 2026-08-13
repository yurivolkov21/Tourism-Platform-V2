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
