import { type Destination, foldAccents, type TourCard } from '@tourism/contract';

/**
 * Bộ lọc client-side của Explore (ADR-0047 T2, handoff §5/§6): API `tours.list`
 * lọc được category/destination/sort — bốn facet dưới đây thì KHÔNG (contract
 * chưa có tham số tương ứng), nên lọc trên tập tour đã tải, đúng cách
 * `apps/web/src/lib/tours.ts` (`filterTours`) đang làm. `search` CŨNG lọc ở
 * đây (`searchTours`, phản hồi 24/09) — KHÔNG gửi cho API nữa, xem doc
 * comment của hàm đó.
 */

export type DurationBucket = '1' | '2-3' | '4+';
export type PriceBucket = '<100' | '100-300' | '300+';

/** Port nguyên ngưỡng từ `apps/web/src/lib/tours.ts` — cùng i18n `explore.duration`. */
export function durationBucket(durationDays: number): DurationBucket {
  if (durationDays <= 1) return '1';
  if (durationDays <= 3) return '2-3';
  return '4+';
}

/** Port nguyên ngưỡng từ `apps/web/src/lib/tours.ts` — cùng i18n `explore.price`. */
export function priceBucket(basePrice: string): PriceBucket {
  const value = Number(basePrice);
  if (value < 100) return '<100';
  if (value <= 300) return '100-300';
  return '300+';
}

/** slug destination → `Destination.region` (bỏ qua destination có `region: null`). */
export function destinationRegionMap(destinations: readonly Destination[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const d of destinations) {
    if (d.region !== null) map.set(d.slug, d.region);
  }
  return map;
}

/**
 * Vùng của một tour — tour không có field `region` riêng (chỉ destination có),
 * nên suy từ destination CHÍNH (`isPrimary`) trước; không có primary hoặc
 * primary chưa biết vùng thì lấy destination đầu tiên map được. Không destination
 * nào map được (bị ẩn/xoá) → `null`, tour đó không lọt facet region nào.
 */
export function regionOfTour(tour: TourCard, regionBySlug: Map<string, string>): string | null {
  const primary = tour.destinations.find((d) => d.isPrimary);
  if (primary) {
    const region = regionBySlug.get(primary.slug);
    if (region !== undefined) return region;
  }
  for (const d of tour.destinations) {
    const region = regionBySlug.get(d.slug);
    if (region !== undefined) return region;
  }
  return null;
}

/** Trạng thái bốn facet client-side — mỗi facet là MẢNG (đa chọn), rỗng = không lọc. */
export interface TourFilterState {
  regions: readonly string[];
  durations: readonly DurationBucket[];
  prices: readonly PriceBucket[];
  difficulties: readonly NonNullable<TourCard['difficulty']>[];
}

export const EMPTY_TOUR_FILTERS: TourFilterState = {
  regions: [],
  durations: [],
  prices: [],
  difficulties: [],
};

/** OR trong cùng một facet, AND giữa các facet — cùng ngữ nghĩa `filterTours` của web. */
export function filterTours<T extends TourCard>(
  tours: readonly T[],
  state: TourFilterState,
  regionBySlug: Map<string, string>,
): T[] {
  return tours.filter((tour) => {
    if (state.regions.length > 0) {
      const region = regionOfTour(tour, regionBySlug);
      if (region === null || !state.regions.includes(region)) return false;
    }
    if (
      state.durations.length > 0 &&
      !state.durations.includes(durationBucket(tour.durationDays))
    ) {
      return false;
    }
    if (state.prices.length > 0 && !state.prices.includes(priceBucket(tour.priceFrom))) {
      return false;
    }
    // Tour không ghi độ khó (null) không lọt bất kỳ nhóm nào — thà thiếu còn
    // hơn xếp bừa vào "Easy" rồi khách đặt nhầm một chuyến leo núi.
    if (
      state.difficulties.length > 0 &&
      (tour.difficulty === null || !state.difficulties.includes(tour.difficulty))
    ) {
      return false;
    }
    return true;
  });
}

/**
 * Tìm trên tiêu đề + tóm tắt + tên destination + tên chuyên mục, bỏ dấu cả
 * hai phía — port nguyên `searchTours` của `apps/web/src/lib/tours.ts`.
 *
 * Lọc CLIENT-SIDE, KHÔNG gửi `search` cho `catalog.tours.list` (handoff §6.2):
 * API hiện tìm bằng ILIKE (có dấu, khớp giữa từ) — gõ "ha" phải ra Hà Nội/Hạ
 * Long/Hà Giang, ILIKE không làm được. Cùng cách web đã né vấn đề này: tải
 * tập tour KHÔNG lọc theo `search`, rồi lọc ở đây.
 */
export function searchTours<T extends TourCard>(tours: readonly T[], query: string): T[] {
  const q = foldAccents(query.trim());
  if (q === '') return [...tours];
  return tours.filter((tour) => {
    const haystack = [
      tour.title,
      tour.summary ?? '',
      tour.category.name,
      ...tour.destinations.map((d) => d.name),
    ].join(' ');
    return foldAccents(haystack).includes(q);
  });
}

/** Số option đang bật trên mọi facet — cho huy hiệu nút Filters. */
export function countActiveFilters(state: TourFilterState): number {
  return (
    state.regions.length + state.durations.length + state.prices.length + state.difficulties.length
  );
}
