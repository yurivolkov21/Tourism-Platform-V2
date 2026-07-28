import type {
  MockDestination,
  MockRegion,
  MockRegionKey,
  MockTourCard,
  MockTourDifficulty,
} from '@/mocks/types';

/** Khoá vùng — TRỎ LỚP TOKEN `[data-region='…']` trong `tokens.css`. Tái dùng
    `MockRegionKey` thay vì khai union thứ hai: web chỉ nên có MỘT kiểu khoá vùng. */
export type RegionKey = MockRegionKey;

/**
 * Logic vùng. 3 vùng sống ở TẦNG TRÌNH BÀY, không đến từ API — Nexora cũng vậy
 * (`regionSlugs()`), nên đây là parity chứ không phải đi tắt.
 * `DestinationSchema.region` (chuỗi tự do) chỉ dùng để XẾP địa điểm vào 3 vùng đó.
 *
 * Dữ liệu vùng nằm ở `mocks/regions.ts`; file này chỉ có hàm, và nhận dữ liệu qua
 * tham số — đúng khuôn `lib/tours.ts`, nhờ đó test được với fixture nhỏ.
 */
export function regionBySlug(regions: readonly MockRegion[], slug: string): MockRegion | undefined {
  return regions.find((region) => region.slug === slug);
}

/**
 * Xếp `region` chuỗi tự do của contract vào một vùng đã biết. Nhận cả tên hiển thị
 * ('Northern Vietnam') lẫn khoá ngắn ('north'), không phân biệt hoa/thường.
 *
 * Bảng nhận dạng SUY TỪ chính `regions` chứ không khai riêng — một bảng alias tách
 * rời là một nguồn nữa có thể trôi khỏi danh sách vùng.
 *
 * Trả `null` khi không nhận ra — KHÔNG đoán, vì đoán sai thì địa điểm bị xếp vào
 * vùng sai. Xem bất biến "không địa điểm nào tàng hình" trong `regions.spec.ts`.
 */
export function regionOf(
  regions: readonly MockRegion[],
  destination: { region: string | null },
): RegionKey | null {
  if (destination.region === null) return null;
  const needle = destination.region.trim().toLowerCase();
  const match = regions.find(
    (region) => region.key === needle || region.name.toLowerCase() === needle,
  );
  return match?.key ?? null;
}

export function destinationsInRegion<T extends { region: string | null }>(
  regions: readonly MockRegion[],
  destinations: readonly T[],
  key: RegionKey,
): T[] {
  return destinations.filter((dest) => regionOf(regions, dest) === key);
}

/**
 * Tour của một vùng = tour DISTINCT chạm bất kỳ địa điểm của vùng.
 *
 * Distinct là phần dễ sai nhất: `ha-long-bay-cruise` chạm cả `ha-long` và
 * `ninh-binh` (cùng vùng Bắc) nên cộng theo địa điểm sẽ đếm nó hai lần.
 */
export function toursInRegion<T extends MockTourCard>(
  regions: readonly MockRegion[],
  destinations: readonly MockDestination[],
  tours: readonly T[],
  key: RegionKey,
): T[] {
  const slugs = new Set(destinationsInRegion(regions, destinations, key).map((d) => d.slug));
  return tours.filter((tour) => tour.destinations.some((dest) => slugs.has(dest.slug)));
}

export interface RegionGlance {
  /** `basePrice` nhỏ nhất — STRING, đúng luật "tiền luôn là string". */
  fromPrice: string;
  difficulties: MockTourDifficulty[];
  categories: { slug: string; name: string }[];
}

/** Bậc độ khó tăng dần — để phổ in ra không phụ thuộc thứ tự gặp. */
const DIFFICULTY_ORDER: MockTourDifficulty[] = ['EASY', 'MODERATE', 'CHALLENGING'];

/**
 * Dải "at a glance" của một vùng. CHỈ ba thứ phân biệt được vùng.
 *
 * Cố tình KHÔNG có số tour và khoảng số ngày: đo trên mock thì số tour là 6/6/6 và
 * khoảng ngày là 1–12 ở CẢ BA vùng (mock chia đều, và tour 12 ngày thuộc cả ba),
 * nên hai con số đó là trang trí chứ không phải thông tin. Số tour chuyển sang tiêu
 * đề khu, nơi nó là ngữ cảnh chứ không giả làm điểm so sánh.
 */
export function regionGlance(tours: readonly MockTourCard[]): RegionGlance | null {
  if (tours.length === 0) return null;

  let fromPrice = tours[0]?.basePrice ?? '0';
  for (const tour of tours) {
    if (Number(tour.basePrice) < Number(fromPrice)) fromPrice = tour.basePrice;
  }

  // `difficulty` nullable: bỏ qua null, không in "null" và không coi nó là một bậc.
  const present = new Set(tours.map((t) => t.difficulty).filter((d) => d !== null));
  const difficulties = DIFFICULTY_ORDER.filter((level) => present.has(level));

  const categories: { slug: string; name: string }[] = [];
  const seen = new Set<string>();
  for (const tour of tours) {
    if (seen.has(tour.category.slug)) continue;
    seen.add(tour.category.slug);
    categories.push(tour.category);
  }

  return { fromPrice, difficulties, categories };
}
