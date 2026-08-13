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
