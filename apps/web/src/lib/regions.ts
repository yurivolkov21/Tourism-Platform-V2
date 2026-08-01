import type { MockRegion, MockRegionKey } from '@/mocks/types';
import type { DestinationVM, TourCardVM, TourReviewVM } from './api/tours';

/** Khoá vùng — giá trị đổ ra thuộc tính `data-region`, nay thuần là móc dữ
    liệu/test (ADR-0015 đã rút lớp tint `[data-region]` khỏi tokens). Tái dùng
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
 * Distinct là phần dễ sai nhất: `halong-bay-overnight-cruise` chạm cả `ha-long`
 * và `ninh-binh` (cùng vùng Bắc) nên cộng theo địa điểm sẽ đếm nó hai lần.
 */
export function toursInRegion<T extends TourCardVM>(
  regions: readonly MockRegion[],
  destinations: readonly DestinationVM[],
  tours: readonly T[],
  key: RegionKey,
): T[] {
  const slugs = new Set(destinationsInRegion(regions, destinations, key).map((d) => d.slug));
  return tours.filter((tour) => tour.destinations.some((dest) => slugs.has(dest.slug)));
}

/**
 * Chuyến RIÊNG của một vùng — tour mà MỌI điểm đến đều nằm trong vùng.
 *
 * Khác `toursInRegion()` một chữ nhưng khác hẳn về nghĩa: hàm kia gom theo
 * `some()` nên nó cũng kéo vào tour XUYÊN VÙNG — `vietnam-grand-journey-12d` dài
 * 12 ngày nhưng chạm cả ba vùng. Nói "chuyến của miền Bắc" về nó là quảng cáo một
 * hành trình mà phần lớn thời gian ở nơi khác. `every()` cho miền Bắc 5 chuyến,
 * dài nhất 8 ngày (`northern-highlands-loop`), đúng nghĩa "Ở ĐÂY".
 *
 * ĐÂY LÀ NƠI DUY NHẤT định nghĩa "riêng của vùng". `longestTourInRegion()` ngay
 * dưới và khu "bạn có mấy ngày" (`region-days.tsx`) đều đi qua hàm này — hai bản
 * định nghĩa song song là hai tập rồi sẽ lệch nhau im lặng, và `regions.spec.ts`
 * có một test canh đúng chuyện đó ("một định nghĩa, hai chỗ dùng").
 *
 * KHÔNG sắp xếp: trả về theo thứ tự catalogue. Nơi gọi tự sắp theo nhu cầu của nó
 * — sắp hộ ở đây là ép một thứ tự lên mọi chỗ dùng.
 */
export function ownToursInRegion<T extends TourCardVM>(
  regions: readonly MockRegion[],
  destinations: readonly DestinationVM[],
  tours: readonly T[],
  key: RegionKey,
): T[] {
  const slugs = new Set(destinationsInRegion(regions, destinations, key).map((d) => d.slug));
  return tours.filter(
    (tour) =>
      // `length > 0` là điều kiện THẬT chứ không phải phòng thủ thừa: `every()`
      // trên mảng rỗng trả true, nên tour không khai điểm đến nào sẽ được nhận
      // làm "chuyến riêng" của MỌI vùng.
      tour.destinations.length > 0 && tour.destinations.every((dest) => slugs.has(dest.slug)),
  );
}

/**
 * Chuyến dài nhất RIÊNG của một vùng — nuôi ô số liệu "Longest trip" ở hero.
 *
 * `null` khi vùng không có chuyến riêng nào (nhánh có thật khi gắn API: một vùng
 * mới chỉ được tour liên vùng ghé qua) — nơi gọi bỏ hẳn phần phụ thuộc vào nó.
 */
export function longestTourInRegion<T extends TourCardVM>(
  regions: readonly MockRegion[],
  destinations: readonly DestinationVM[],
  tours: readonly T[],
  key: RegionKey,
): T | null {
  let longest: T | null = null;
  for (const tour of ownToursInRegion(regions, destinations, tours, key)) {
    // `>` chứ không `>=`: hai chuyến bằng nhau thì giữ chuyến GẶP TRƯỚC, để thứ
    // tự catalogue quyết định thay vì thứ tự lặp ngược.
    if (longest === null || tour.durationDays > longest.durationDays) longest = tour;
  }
  return longest;
}

/** Một review kèm tour đã sinh ra nó — khu "Khách nói gì" cần cả hai để in được
    dòng ghi công `on <tour>` và link sang trang tour. */
export interface RegionReview {
  review: TourReviewVM;
  tourSlug: string;
  tourTitle: string;
}

/**
 * Review THẬT của một vùng, trải phẳng và sắp NGÀY MỚI NHẤT TRƯỚC.
 *
 * Đi qua `toursInRegion()` (gom theo `some()`), KHÔNG qua `ownToursInRegion()`, và
 * đó là quyết định chứ không phải sơ suất: tập tour ở đây phải TRÙNG tập mà lưới 6
 * tour card trên cùng trang đang hiện. Lưới đó dùng `toursInRegion`, nên nó có
 * `vietnam-grand-journey-12d` ở cả ba trang; loại review của chuyến đó ra là để trang
 * hiện một tour rồi giấu lời của người đã đi nó. Thứ giữ chuyện này khỏi thành nói
 * sai là dòng ghi công `on <tour>` — người đọc thấy ngay review nói về chuyến 12
 * ngày xuyên Việt, không phải về riêng miền Nam. Hệ quả đo được: Bắc 37 · Trung 27
 * · Nam 25, và 5 review của tour xuyên vùng được đếm ở cả ba (`regions.spec.ts`
 * canh cả hai con số).
 *
 * `reviewsByTour` vào bằng THAM SỐ, không `import TOUR_REVIEWS` — đúng khuôn mọi
 * hàm khác trong file, nhờ đó test được với fixture nhỏ. Nó cũng gương đúng ranh
 * giới của API thật: review đến từ một lời gọi RIÊNG có phân trang
 * (`reviews.listByTour`), không nằm trong payload của tour.
 *
 * Tour thiếu khoá trong `reviewsByTour` (`phu-quoc-reef-days`, `ratingAvg: null`)
 * chỉ đơn giản không góp gì — không ném, không đẩy một mục rỗng vào danh sách.
 */
export function reviewsInRegion(
  regions: readonly MockRegion[],
  destinations: readonly DestinationVM[],
  tours: readonly TourCardVM[],
  reviewsByTour: Readonly<Record<string, readonly TourReviewVM[]>>,
  key: RegionKey,
): RegionReview[] {
  const flat: RegionReview[] = [];
  for (const tour of toursInRegion(regions, destinations, tours, key)) {
    for (const review of reviewsByTour[tour.slug] ?? []) {
      flat.push({ review, tourSlug: tour.slug, tourTitle: tour.title });
    }
  }

  // `id` là tie-break, không phải trang trí: hai review cùng `createdAt` là chuyện
  // có thật (mock có nhiều review cùng ngày), và không có chốt thứ hai thì thứ tự
  // phụ thuộc thuật toán sort của runtime — ba review "mới nhất" đổi chỗ giữa các
  // lần build. Cùng luật `tourReviews()` trong lib/tours.ts đang dùng.
  return flat.sort((a, b) => {
    if (a.review.createdAt !== b.review.createdAt) {
      return a.review.createdAt < b.review.createdAt ? 1 : -1;
    }
    if (a.review.id !== b.review.id) return a.review.id < b.review.id ? 1 : -1;
    return 0;
  });
}

/**
 * Chọn ra `count` điểm đến nổi bật nhất — quyết định user 31/07: Home giữ ĐÚNG
 * 9 tile như thiết kế đã duyệt (heading "Nine places…"), còn `/destinations`
 * mới là nơi hiện đủ 19 điểm API trả về.
 *
 * Sắp theo `tourCount` GIẢM dần. Tie-break 1: thứ tự vùng Bắc→Trung→Nam (theo
 * index trong `regions`) — điểm đến không nhận diện được vùng (`regionOf` trả
 * `null`) xếp CUỐI. Tie-break 2: `name` tăng dần — chốt ổn định, không phụ
 * thuộc thứ tự gặp hay thuật toán sort của runtime, đúng nếp tie-break đã dùng
 * ở `reviewsInRegion` phía trên.
 *
 * Trả mảng MỚI (không sửa `destinations` gốc); `count` lớn hơn độ dài mảng thì
 * trả hết, không ném lỗi.
 */
export function topDestinations(
  regions: readonly MockRegion[],
  destinations: readonly DestinationVM[],
  count: number,
): DestinationVM[] {
  const regionRank = (dest: DestinationVM): number => {
    const key = regionOf(regions, dest);
    if (key === null) return regions.length; // vùng lạ/không nhận diện được → cuối
    const idx = regions.findIndex((region) => region.key === key);
    return idx === -1 ? regions.length : idx;
  };

  return [...destinations]
    .sort((a, b) => {
      if (a.tourCount !== b.tourCount) return b.tourCount - a.tourCount;
      const regionDiff = regionRank(a) - regionRank(b);
      if (regionDiff !== 0) return regionDiff;
      if (a.name !== b.name) return a.name < b.name ? -1 : 1;
      return 0;
    })
    .slice(0, count);
}

/** Độ khó SIẾT non-null — `TourCardVM['difficulty']` là union nullable (field
    dùng để LỌC/GOM, `null` đã bị loại trước khi vào đây, xem `regionGlance`). */
type TourDifficultyVM = NonNullable<TourCardVM['difficulty']>;

export interface RegionGlance {
  /** `basePrice` nhỏ nhất — STRING, đúng luật "tiền luôn là string". */
  fromPrice: string;
  difficulties: TourDifficultyVM[];
  categories: { slug: string; name: string }[];
}

/** Bậc độ khó tăng dần — để phổ in ra không phụ thuộc thứ tự gặp. */
const DIFFICULTY_ORDER: TourDifficultyVM[] = ['EASY', 'MODERATE', 'CHALLENGING'];

/**
 * Dải "at a glance" của một vùng. CHỈ ba thứ phân biệt được vùng.
 *
 * Cố tình KHÔNG có số tour và khoảng số ngày: đo trên mock thì số tour là 6/6/6 và
 * khoảng ngày là 1–12 ở CẢ BA vùng (mock chia đều, và tour 12 ngày thuộc cả ba),
 * nên hai con số đó là trang trí chứ không phải thông tin. Số tour chuyển sang tiêu
 * đề khu, nơi nó là ngữ cảnh chứ không giả làm điểm so sánh.
 */
export function regionGlance(tours: readonly TourCardVM[]): RegionGlance | null {
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
