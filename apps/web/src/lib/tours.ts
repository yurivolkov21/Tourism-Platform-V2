import type { TourCardVM } from '@/lib/api/tours';
import type { MockDestinationLink, MockMediaItem } from '@/mocks/types';
import { foldAccents } from './text';

/** Một mục của thẻ facet "Category": slug để lọc, tên để người đọc. */
export interface CategoryOption {
  slug: string;
  name: string;
}

/**
 * Bộ chip danh mục của `/tours` — endpoint quyết chip NÀO có, tour đã tải chỉ
 * bù tên và bù ca thiếu.
 *
 * Ba việc, và mỗi việc đóng đúng một lỗ mà vòng review F14 tìm ra:
 *
 * 1. **`categories` là nguồn và là THỨ TỰ.** `is_active` và `order` do admin
 *    đặt chỉ có nghĩa nếu trang này tôn trọng đúng danh sách server trả về.
 * 2. **Slug đang lọc mà vắng mặt thì bù vào CUỐI.** Ca thật: admin vừa ẩn một
 *    danh mục, nhưng link cũ `/tours?categories=<slug>` vẫn lọc đúng vì API
 *    công khai KHÔNG gác `isActive` khi lọc tour. Không bù thì chip đang bật
 *    in slug máy (`?? value` ở `ToursExplorer`) và khách không có ô nào để bỏ
 *    tick — lưới bị thu hẹp mà không ai giải thích vì sao.
 * 3. **`categories === null` nghĩa là lời gọi HỎNG**, khác hẳn mảng rỗng
 *    (mọi danh mục đều đã ẩn — hợp lệ). Hỏng thì suy từ tour đã tải, tức rơi
 *    về đúng hành vi trước 22/09, thay vì bày một thẻ facet trống trơn.
 */
export function resolveCategoryOptions(
  categories: readonly CategoryOption[] | null,
  tours: readonly TourCardVM[],
  selected: readonly string[],
): CategoryOption[] {
  const fromTours = new Map<string, string>();
  for (const tour of tours) fromTours.set(tour.category.slug, tour.category.name);

  if (categories === null) {
    return [...fromTours].map(([slug, name]) => ({ slug, name }));
  }

  const options = categories.map((category) => ({ slug: category.slug, name: category.name }));
  const known = new Set(options.map((option) => option.slug));
  for (const slug of selected) {
    if (known.has(slug)) continue;
    known.add(slug);
    options.push({ slug, name: fromTours.get(slug) ?? slug });
  }
  return options;
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
    gạch không cao hơn giá gốc — dữ liệu lệch không được hiện "−0%" hay số âm.

    Tính trên SỐ XU NGUYÊN (15/09/2026): chia thẳng hai số thực thì
    `(35 − 28.35) / 35 × 100` ra 18.999999999999993 và làm tròn xuống thành 18,
    trong khi mức giảm đúng là 19%. Quy về xu trước thì phép trừ và phép nhân đều
    chính xác, `Math.floor` chỉ còn cắt phần lẻ THẬT. */
export function discountPercent(basePrice: string, compareAtPrice: string | null): number | null {
  if (compareAtPrice === null) return null;
  const base = Math.round(Number(basePrice) * 100);
  const compare = Math.round(Number(compareAtPrice) * 100);
  if (!(compare > base)) return null;
  return Math.floor(((compare - base) * 100) / compare);
}

/**
 * Giá gạch của MỘT mức giá — luật DUY NHẤT cho mọi chỗ in giá gạch và chip −N%:
 * card listing (qua `cardPrice`) lẫn mọi bề mặt trang chi tiết (qua
 * `resolveDepartureAnchors` ở `lib/tour-detail.ts`).
 *
 * Quyết định user 15/09/2026: **chỉ gạch giá khi có khuyến mãi THẬT**. Tập ứng
 * viên gồm `basePrice` nếu giá khách trả thấp hơn nó, và neo riêng của đợt
 * (`anchor`) nếu neo cao hơn giá trả; lấy số cao nhất, tập rỗng thì không gạch.
 *
 * Luật này THAY luật "neo cao nhất" của sweep giá 19/08 — `max(neo đợt, neo tour)`,
 * áp `tour.compareAtPrice` (giá niêm yết) cho MỌI đợt. Giá niêm yết là con số không
 * ai trả, nên chồng nó lên làm chip phóng đại khuyến mãi thật: thẻ "Hanoi Old
 * Quarter Street Food by Night" in "$28 was $42 −32%" trong khi đợt khuyến mãi chỉ
 * là $28.35 trên giá gốc $35 (−19%). Vì vậy KHÔNG có tham số nào cho giá niêm yết:
 * field đó vẫn nằm trong DTO, web chỉ thôi hiển thị nó.
 *
 * So sánh bằng `Number()` nhưng trả lại NGUYÊN chuỗi thập phân thắng cuộc — tiền
 * vẫn là chuỗi, không đi vòng qua số thực rồi `toFixed`.
 */
export function strikePrice({
  price,
  basePrice,
  anchor,
}: {
  /** Giá khách trả — `effectivePrice` của đợt, hoặc `priceFrom` ở card. */
  price: string;
  basePrice: string;
  /** Neo riêng của đợt (`departure.compareAtPrice` thô từ API); card không có → `null`. */
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

/**
 * Giá trên card listing (`TourCard`, `TourListCard`). Card chỉ có `basePrice` và
 * `priceFrom`, không có neo của đợt nào, nên đây là `strikePrice` với `anchor: null`:
 * gạch `basePrice` và hiện chip CHỈ khi `priceFrom < basePrice`, phần trăm tính từ
 * đúng hai số đó (cùng cách làm tròn của `discountPercent`).
 *
 * Khớp trang chi tiết mỗi khi đợt rẻ nhất lấy `basePrice` làm neo — đúng cách seed
 * đặt mọi khuyến mãi (`compareAtPrice = basePrice`). Đợt rẻ nhất có neo riêng CAO
 * HƠN base thì chi tiết gạch neo đó còn card vẫn gạch base: card không có dữ liệu
 * để biết.
 *
 * `?? basePrice`: `priceFrom` là field additive (19/08) — API deploy SAU web, hoặc
 * API dev chạy bản build cũ, thì card vẫn ra số thay vì vỡ trang /tours vì một field.
 */
export function cardPrice(tour: { basePrice: string; priceFrom?: string | null }): {
  price: string;
  compareAtPrice: string | null;
  discount: number | null;
} {
  const price = tour.priceFrom ?? tour.basePrice;
  const compareAtPrice = strikePrice({ price, basePrice: tour.basePrice, anchor: null });
  return { price, compareAtPrice, discount: discountPercent(price, compareAtPrice) };
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

/**
 * Tiền giữ ĐỦ hai số lẻ — dùng cho SỐ TIỀN THẬT, khác `formatMoney` ở trên
 * (giá tour làm tròn về đơn vị, chuyện biên tập).
 *
 * Ranh giới là: làm tròn một mức GIÁ chỉ làm nó dễ đọc, còn làm tròn một số
 * tiền HOÀN là hứa sai. 50% của $1,199 là $599.50; in thành "$600" là nói với
 * khách một con số họ sẽ không nhận được, và họ có thể đối chiếu với sao kê.
 *
 * Cache theo currency vì hàm này nằm trong render path của dialog xin huỷ —
 * dialog render lại theo từng phím gõ trong ô lý do (cùng lý do với
 * `formatAmount` bên admin). Tập currency hữu hạn, sống trọn đời module.
 */
const EXACT_FORMATTERS = new Map<string, Intl.NumberFormat>();

export function formatMoneyExact(amount: string, currency: string): string {
  let formatter = EXACT_FORMATTERS.get(currency);
  if (!formatter) {
    try {
      formatter = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } catch {
      // Contract chỉ ép `length(3)`, không ép ISO-4217. Một currency lạ mà để
      // RangeError nổ trong render là mất luôn cái dialog xin huỷ — in thô còn
      // hơn không huỷ được.
      return `${amount} ${currency}`;
    }
    EXACT_FORMATTERS.set(currency, formatter);
  }
  return formatter.format(Number(amount));
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

/**
 * Đợt CHỌN ĐƯỢC để đặt: server nói còn trong hạn đặt (`bookable`, tính theo ngày
 * Việt Nam — ADR-0041 §7) VÀ còn chỗ. Web không tự so ngày chót với giờ trình
 * duyệt; mọi chỗ chọn đợt (provider, ô ngày, bảng Departures, modal All dates,
 * wizard, trang /book) đi qua đúng hàm này để không nơi nào nói khác nơi nào.
 */
export function isDepartureOpen(departure: { bookable: boolean; seatsLeft: number }): boolean {
  return departure.bookable && departure.seatsLeft > 0;
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

/** Thứ viết tắt, đọc theo UTC — cùng luật timezone với `MONTHS`. */
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Ngày trên MỘT HÀNG của modal "All dates": `"Mon, 14 Sep"` — thứ + ngày hai
 * chữ số + tháng viết tắt, KHÔNG năm. Đây là con chữ bản wireframe đã duyệt.
 *
 * Ngày đệm 0 (`"Thu, 01 Oct"`) để cột ngày thẳng hàng khi danh sách dài.
 *
 * Thứ tính bằng `Date.UTC` rồi `getUTCDay()`, KHÔNG `new Date(chuỗi date-only)`:
 * chuỗi đó bị hiểu là UTC rồi hiển thị theo giờ máy, lệch một ngày ở múi giờ âm
 * — và lệch ngày thì lệch luôn cả thứ.
 */
export function formatDialogDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number];
  const dow = DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${dow}, ${String(d).padStart(2, '0')} ${MONTHS[m - 1]}`;
}

/**
 * Ngày trên ô chọn đợt của panel đặt chỗ: `"14 Sep"` — ngày + tháng viết tắt,
 * KHÔNG in hoa, KHÔNG năm. Đây là con chữ bản wireframe đã duyệt dùng.
 *
 * Ba biến thể ngày ngắn của repo cố tình khác nhau, đừng gộp: `formatChipDate`
 * ("14 Sep") cho ô chọn đợt · `formatTicketDate` ("14 SEP") cho khoảnh khắc
 * primary trên vé `/checkout/success` · `formatDate` ("14 Sep 2026") cho trigger
 * DatePicker, nơi thiếu năm là mơ hồ thật sự.
 *
 * Cùng luật timezone: tách chuỗi `YYYY-MM-DD`, KHÔNG qua `new Date()` — chuỗi
 * date-only bị hiểu là UTC rồi hiển thị theo giờ máy, lệch một ngày ở múi giờ âm.
 */
export function formatChipDate(date: string): string {
  const [, m, d] = date.split('-').map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]}`;
}

/** Ngày ngắn kiểu vé máy bay ("24 AUG") — ngày + tháng viết tắt HOA, KHÔNG
    năm. Dùng riêng cho khoảnh khắc primary trên vé (`/checkout/success`),
    khác `formatDate` (đủ năm, dùng cho trigger DatePicker). Cùng luật
    timezone: tách chuỗi YYYY-MM-DD, KHÔNG qua `new Date()`. */
export function formatTicketDate(date: string): string {
  const [, m, d] = date.split('-').map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1]?.toUpperCase()}`;
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
