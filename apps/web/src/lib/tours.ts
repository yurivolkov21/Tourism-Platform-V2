import type { TourCardVM, TourDetailVM, TourReviewVM } from '@/lib/api/tours';
import type { MockDestinationLink, MockMediaItem, MockPolicyKind } from '@/mocks/types';
import { foldAccents } from './text';

type Policy = TourDetailVM['policies'][number];

/** Chuyên mục duy nhất kèm số tour — nguồn cho hàng chip lọc. Giữ thứ tự xuất
    hiện trong mảng gốc (không sắp lại) để chip không nhảy chỗ khi thêm tour. */
export function tourCategories(
  tours: readonly TourCardVM[],
): { slug: string; name: string; count: number }[] {
  const map = new Map<string, { slug: string; name: string; count: number }>();
  for (const tour of tours) {
    const existing = map.get(tour.category.slug);
    if (existing) existing.count += 1;
    else map.set(tour.category.slug, { ...tour.category, count: 1 });
  }
  return [...map.values()];
}

export type DurationBucket = '1' | '2-3' | '4+';
export type PriceBucket = '<100' | '100-300' | '300+';

/** Nhóm thời lượng cho facet sidebar. Ngưỡng khớp Nexora để copy i18n port
    sang dùng lại được nguyên văn. */
export function durationBucket(durationDays: number): DurationBucket {
  if (durationDays <= 1) return '1';
  if (durationDays <= 3) return '2-3';
  return '4+';
}

/** Nhóm giá. `basePrice` là chuỗi thập phân — Number() chỉ để SO SÁNH ở đây,
    không bao giờ để tính tiền. Biên: 100 và 300 thuộc nhóm giữa. */
export function priceBucket(basePrice: string): PriceBucket {
  const value = Number(basePrice);
  if (value < 100) return '<100';
  if (value <= 300) return '100-300';
  return '300+';
}

/** Trạng thái bộ lọc sidebar. Mọi facet là MẢNG (đa chọn) trừ `featured` —
    nó là công tắc một chiều: `false` nghĩa là KHÔNG lọc, không phải "chỉ tour
    không featured". */
export interface TourFilterState {
  categories: readonly string[];
  destinations: readonly string[];
  durations: readonly DurationBucket[];
  prices: readonly PriceBucket[];
  difficulties: readonly NonNullable<TourCardVM['difficulty']>[];
  featured: boolean;
}

export const EMPTY_TOUR_FILTERS: TourFilterState = {
  categories: [],
  destinations: [],
  durations: [],
  prices: [],
  difficulties: [],
  featured: false,
};

/**
 * Lọc theo toàn bộ facet. Ngữ nghĩa chuẩn của mọi bộ lọc mặt hàng:
 * **OR trong cùng một facet, AND giữa các facet**. Chọn "Trekking" + "Food" ra
 * hợp của hai; thêm "Sa Pa" thì giao với nó.
 *
 * Facet rỗng = không lọc. Giá trị lạ (link cũ / gõ tay) cho mảng RỖNG chứ
 * không âm thầm rơi về "All" — đúng bug đã sửa ở /blog.
 *
 * LƯU Ý KHI GẮN API: `categories`/`destinations`/`featured` có tham số tương
 * ứng trong ToursListQuerySchema, nhưng `durations`/`prices`/`difficulties`
 * thì KHÔNG — ba facet đó hiện chỉ chạy được vì dữ liệu là mock nằm sẵn ở
 * client. Xem nợ mở rộng contract trong spec §8.
 */
export function filterTours<T extends TourCardVM>(
  tours: readonly T[],
  state: TourFilterState,
): T[] {
  return tours.filter((tour) => {
    if (state.categories.length > 0 && !state.categories.includes(tour.category.slug)) return false;
    if (
      state.destinations.length > 0 &&
      !tour.destinations.some((d) => state.destinations.includes(d.slug))
    ) {
      return false;
    }
    if (
      state.durations.length > 0 &&
      !state.durations.includes(durationBucket(tour.durationDays))
    ) {
      return false;
    }
    if (state.prices.length > 0 && !state.prices.includes(priceBucket(tour.basePrice)))
      return false;
    // Tour không ghi độ khó KHÔNG lọt bất kỳ nhóm nào — thà thiếu còn hơn xếp
    // bừa vào "Easy" rồi khách đặt nhầm một chuyến leo núi.
    if (
      state.difficulties.length > 0 &&
      (tour.difficulty === null || !state.difficulties.includes(tour.difficulty))
    ) {
      return false;
    }
    if (state.featured && !tour.isFeatured) return false;
    return true;
  });
}

/** Khoá của các facet dạng mảng — `featured` không nằm ở đây vì nó là boolean. */
export type ArrayFacetKey = 'categories' | 'destinations' | 'durations' | 'prices' | 'difficulties';

/**
 * Số kết quả mỗi option SẼ cho, để hiện cạnh nhãn và làm mờ option ra 0.
 * Đây là thứ ngăn ngõ cụt "bấm thêm một ô rồi trắng trang".
 *
 * Quy tắc then chốt — đếm cho facet F thì **bỏ qua lựa chọn hiện tại của chính
 * F**, chỉ áp các facet khác. Vì trong cùng facet là OR: đang chọn "Trekking"
 * mà đếm "Food" theo cả state thì ra 0 (không tour nào vừa trekking vừa food),
 * và người dùng tưởng Food hỏng. Đúng ra Food phải hiện số tour food thật, vì
 * bấm vào là THÊM chứ không phải giao.
 *
 * `tours` truyền vào nên là danh sách ĐÃ lọc theo ô tìm kiếm — search thu hẹp
 * mọi facet.
 */
export function facetOptionCounts<T extends TourCardVM>(
  tours: readonly T[],
  state: TourFilterState,
  facet: ArrayFacetKey,
  options: readonly string[],
): Record<string, number> {
  const base = { ...state, [facet]: [] } as TourFilterState;
  const counts: Record<string, number> = {};
  for (const option of options) {
    counts[option] = filterTours(tours, { ...base, [facet]: [option] }).length;
  }
  return counts;
}

/** Số tour featured còn lại theo các facet khác đang bật — cho ô "Featured trips". */
export function featuredOptionCount<T extends TourCardVM>(
  tours: readonly T[],
  state: TourFilterState,
): number {
  return filterTours(tours, { ...state, featured: true }).length;
}

/** Số option đang bật — cho huy hiệu trên nút "Filters" và nút thu/mở sidebar. */
export function countActiveFilters(state: TourFilterState): number {
  return (
    state.categories.length +
    state.destinations.length +
    state.durations.length +
    state.prices.length +
    state.difficulties.length +
    (state.featured ? 1 : 0)
  );
}

/** Tìm trên tiêu đề + tóm tắt + tên destination + tên chuyên mục, bỏ dấu cả hai
    phía. `summary` nullable nên phải hứng null trước khi ghép chuỗi. */
export function searchTours<T extends TourCardVM>(tours: readonly T[], query: string): T[] {
  const q = foldAccents(query.trim());
  if (!q) return [...tours];
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

export type TourSortKey = 'createdAt' | 'basePrice' | 'durationDays' | 'title';

/**
 * Sắp xếp. Trả mảng MỚI — mock là hằng số dùng chung, sửa tại chỗ là làm hỏng
 * dữ liệu của mọi trang khác.
 *
 * `createdAt` KHÔNG phải field của contract (nó chỉ là sort key phía server, và
 * `TourCardSchema` không trả nó). Quy ước static-first: thứ tự mảng mock CHÍNH
 * LÀ thứ tự `createdAt desc`. Khi gắn API thật nhánh này biến mất — server sắp
 * hộ và client chỉ truyền `sort=createdAt&order=desc`.
 */
export function sortTours<T extends TourCardVM>(
  tours: readonly T[],
  key: TourSortKey,
  order: 'asc' | 'desc',
): T[] {
  if (key === 'createdAt') {
    return order === 'desc' ? [...tours] : [...tours].reverse();
  }
  const sign = order === 'asc' ? 1 : -1;
  return [...tours].sort((a, b) => {
    if (key === 'basePrice') {
      // So sánh theo SỐ: "89.00" < "1480.00" về mặt số nhưng ">" về mặt chuỗi.
      return (Number(a.basePrice) - Number(b.basePrice)) * sign;
    }
    if (key === 'durationDays') return (a.durationDays - b.durationDays) * sign;
    return a.title.localeCompare(b.title) * sign;
  });
}

/**
 * Trung bình rating, làm tròn tới MỘT chữ số thập phân — khớp `Decimal(2,1)` của
 * cột `ratingAvg` được denormalize ở backend, nên số ở tầng tĩnh và số từ API
 * không lệch nhau ở chữ số thứ hai.
 *
 * Mảng rỗng trả `null`, KHÔNG phải 0: "chưa ai đánh giá" khác "bị chấm 0 điểm", và
 * cả contract lẫn UI đều phân biệt hai thứ đó.
 */
export function averageRating(reviews: readonly TourReviewVM[]): number | null {
  if (reviews.length === 0) return null;
  const sum = reviews.reduce((acc, review) => acc + review.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}

/**
 * Review theo ĐÚNG thứ tự server trả về: `authorDeleted asc → createdAt desc`.
 *
 * Sao y `ReviewsService.listByTour` chứ không tự chọn thứ tự đẹp hơn: nếu client
 * sắp khác server thì trang 1 ở cụm tĩnh và trang 1 sau khi gắn API sẽ là hai danh
 * sách khác nhau, và không ai nhận ra cho tới lúc so bằng mắt. Review của tài khoản
 * đã xoá chìm xuống cuối — chúng vẫn là đánh giá thật nên không bị bỏ, chỉ không
 * chiếm chỗ trên cùng.
 */
export function tourReviews(reviews: readonly TourReviewVM[]): TourReviewVM[] {
  return [...reviews].sort((a, b) => {
    if (a.authorDeleted !== b.authorDeleted) return a.authorDeleted ? 1 : -1;
    if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
    return a.id < b.id ? 1 : -1;
  });
}

/**
 * Ngày của review: "July 2026".
 *
 * `Intl` + `new Date()` ở đây là ĐÚNG, khác hẳn `formatDateRange`: `createdAt` là
 * ISO datetime có múi giờ tường minh (`…Z`) nên không có chỗ nào để diễn giải sai.
 * Bẫy "đừng dựng new Date()" chỉ áp cho `startDate`/`endDate` dạng date-only
 * `YYYY-MM-DD` — chuỗi đó bị hiểu là UTC rồi hiển thị theo giờ máy, lệch một ngày
 * ở múi giờ âm.
 *
 * Chỉ tháng + năm, không ngày: độ chính xác tới ngày không giúp người đọc quyết
 * định gì, mà lại làm review trông "cũ" một cách không cần thiết.
 */
const REVIEW_DATE_FMT = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

export function formatReviewDate(createdAt: string): string {
  return REVIEW_DATE_FMT.format(new Date(createdAt));
}

/**
 * Ảnh cho gallery, theo đúng thứ tự sẽ hiển thị: ảnh dẫn trước, rồi phần còn lại
 * theo `sortOrder`.
 *
 * Ba luật, mỗi luật một lý do:
 *  1. `role: 'hero'` lên đầu BẤT KỂ `sortOrder` — ô lớn của khảm là ảnh biên tập
 *     chọn làm ảnh dẫn, không phải "ảnh có sortOrder nhỏ nhất". Không có hero thì
 *     ảnh gallery đầu tiên lên thay (nhánh thật: upload xong mà quên đánh dấu).
 *  2. Bỏ `type: 'VIDEO'`. Contract cho phép video (kèm `posterUrl`) nhưng gallery
 *     mới chỉ render ảnh; lọc ở đây để UI không phải đoán, và `mocks.spec.ts` canh
 *     rằng mock chưa có VIDEO nào.
 *  3. Bỏ `role: 'avatar' | 'body'` — avatar là ảnh người, body là ảnh chèn trong
 *     thân bài. Cùng bảng `MediaAsset` nhưng không phải ảnh của chuyến đi.
 */
export function tourGallery(media: readonly MockMediaItem[]): MockMediaItem[] {
  const usable = media.filter(
    (item) => item.type === 'IMAGE' && (item.role === 'hero' || item.role === 'gallery'),
  );
  const hero = usable.filter((item) => item.role === 'hero');
  const rest = usable
    .filter((item) => item.role !== 'hero')
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return [...hero, ...rest];
}

/** Chuỗi chặng: destination chính đứng đầu, phần còn lại giữ nguyên thứ tự
    biên tập. Contract nói primary đứng đầu nhưng không bảo đảm, nên sắp lại ở
    đây thay vì tin vào thứ tự trả về. */
export function routeChain(destinations: readonly MockDestinationLink[]): MockDestinationLink[] {
  const primary = destinations.filter((d) => d.isPrimary);
  const rest = destinations.filter((d) => !d.isPrimary);
  return [...primary, ...rest];
}

/** Phần trăm giảm giá, làm tròn xuống. Trả null khi không có giá gạch HOẶC giá
    gạch không cao hơn giá gốc — dữ liệu lệch không được hiện "−0%" hay số âm. */
export function discountPercent(basePrice: string, compareAtPrice: string | null): number | null {
  if (compareAtPrice === null) return null;
  const base = Number(basePrice);
  const compare = Number(compareAtPrice);
  if (!(compare > base)) return null;
  return Math.floor(((compare - base) / compare) * 100);
}

/** Tiền từ chuỗi thập phân sang chữ hiển thị. `Number()` chỉ dùng ở BƯỚC CUỐI
    để định dạng, không bao giờ để tính tiền — nguồn sự thật vẫn là chuỗi. */
export function formatMoney(amount: string, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export type DepartureStatus = 'sold-out' | 'limited' | 'available';

/** Trạng thái đợt khởi hành là SUY DIỄN Ở TẦNG UI từ `seatsLeft`, KHÔNG phải
    field của contract — đừng đi tìm `departure.status` khi gắn API. Ngưỡng 3 là
    lựa chọn biên tập (spec §6.3); đổi ở đúng một chỗ này. */
export function departureStatus(seatsLeft: number): DepartureStatus {
  if (seatsLeft <= 0) return 'sold-out';
  if (seatsLeft <= 3) return 'limited';
  return 'available';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Dải ngày gọn: gộp phần trùng nhau. `startDate`/`endDate` là ngày lịch
    (YYYY-MM-DD) nên tách bằng chuỗi — KHÔNG dựng `new Date()` vì nó diễn giải
    chuỗi này theo UTC rồi hiển thị theo giờ máy, lệch một ngày ở múi giờ âm. */
/** In một ngày lịch đơn (`YYYY-MM-DD` → "D MMM YYYY"), dùng cho trigger của
    DatePicker. Cùng luật timezone với `formatDateRange`: tách chuỗi, KHÔNG
    qua `new Date()`. */
export function formatDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export function formatDateRange(startDate: string, endDate: string): string {
  const [sy, sm, sd] = startDate.split('-').map(Number) as [number, number, number];
  const [ey, em, ed] = endDate.split('-').map(Number) as [number, number, number];
  const sMonth = MONTHS[sm - 1];
  const eMonth = MONTHS[em - 1];
  if (sy !== ey) return `${sd} ${sMonth} ${sy} – ${ed} ${eMonth} ${ey}`;
  if (sm !== em) return `${sd} ${sMonth} – ${ed} ${eMonth} ${ey}`;
  // Tour trong ngày: start trùng end, in một ngày thay vì "14–14 Aug".
  if (sd === ed) return `${sd} ${sMonth} ${sy}`;
  return `${sd}–${ed} ${sMonth} ${sy}`;
}

// Thứ tự cố định: hủy chuyến là thứ khách lo nhất nên đứng đầu.
const POLICY_ORDER: MockPolicyKind[] = ['CANCELLATION', 'BOOKING', 'GENERAL'];

/** Gom policy theo `kind` với thứ tự cố định. Nhóm rỗng bị loại — không render
    tiêu đề nhóm trống. */
export function groupPoliciesByKind(
  policies: readonly Policy[],
): { kind: MockPolicyKind; items: Policy[] }[] {
  return POLICY_ORDER.map((kind) => ({
    kind,
    items: policies.filter((p) => p.kind === kind),
  })).filter((group) => group.items.length > 0);
}

/** Gợi ý cuối trang: cùng chuyên mục trước, rồi tour chia chung destination,
    rồi bù bằng phần còn lại. Nexora cắt 4 tour đầu không xét gì — đừng port. */
export function relatedTours<T extends TourCardVM>(
  tours: readonly T[],
  slug: string,
  limit: number,
): T[] {
  const current = tours.find((tour) => tour.slug === slug);
  const others = tours.filter((tour) => tour.slug !== slug);
  if (!current) return others.slice(0, limit);

  const destinationSlugs = new Set(current.destinations.map((d) => d.slug));
  const sameCategory = others.filter((tour) => tour.category.slug === current.category.slug);
  const sharesDestination = others.filter(
    (tour) =>
      tour.category.slug !== current.category.slug &&
      tour.destinations.some((d) => destinationSlugs.has(d.slug)),
  );
  // So sánh theo slug thay vì reference-identity: `sameCategory`/`sharesDestination`
  // đều lọc từ CÙNG mảng `others` nên includes() cũng đúng, nhưng phụ thuộc ngầm
  // đó từng gây bug ở lib/blog.ts — tránh lặp lại.
  const picked = new Set([...sameCategory, ...sharesDestination].map((t) => t.slug));
  const filler = others.filter((tour) => !picked.has(tour.slug));
  return [...sameCategory, ...sharesDestination, ...filler].slice(0, limit);
}
