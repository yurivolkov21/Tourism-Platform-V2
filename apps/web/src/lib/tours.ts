import type {
  MockDestinationLink,
  MockPolicyKind,
  MockTourCard,
  MockTourDetail,
} from '@/mocks/types';
import { foldAccents } from './text';

type Policy = MockTourDetail['policies'][number];

/** Chuyên mục duy nhất kèm số tour — nguồn cho hàng chip lọc. Giữ thứ tự xuất
    hiện trong mảng gốc (không sắp lại) để chip không nhảy chỗ khi thêm tour. */
export function tourCategories(
  tours: readonly MockTourCard[],
): { slug: string; name: string; count: number }[] {
  const map = new Map<string, { slug: string; name: string; count: number }>();
  for (const tour of tours) {
    const existing = map.get(tour.category.slug);
    if (existing) existing.count += 1;
    else map.set(tour.category.slug, { ...tour.category, count: 1 });
  }
  return [...map.values()];
}

/** Lọc theo chuyên mục. Slug lạ (link cũ / gõ tay) phải cho mảng RỖNG để trang
    hiện trạng thái rỗng — KHÔNG âm thầm rơi về "All". Đây đúng là bug đã sửa ở
    /blog: lọc sạch tag lạ thành undefined làm URL vẫn ghi ?tag=… mà lưới hiện
    đủ bài với chip "All" sáng. */
export function filterToursByCategory<T extends MockTourCard>(
  tours: readonly T[],
  categorySlug?: string,
): T[] {
  if (!categorySlug) return [...tours];
  return tours.filter((tour) => tour.category.slug === categorySlug);
}

/** Lọc theo destination — khớp BẤT KỲ điểm nào tour đi qua, không chỉ primary.
    Một tour đi qua nhiều nơi; đây là lý do contract trả cả mảng thay vì một
    `primaryDestination` đơn như bản cũ. */
export function filterToursByDestination<T extends MockTourCard>(
  tours: readonly T[],
  destinationSlug?: string,
): T[] {
  if (!destinationSlug) return [...tours];
  return tours.filter((tour) => tour.destinations.some((d) => d.slug === destinationSlug));
}

/** `undefined` = không lọc; `false` = chỉ tour KHÔNG featured. Hai thứ khác
    nhau, đừng gộp bằng falsy check. */
export function filterToursByFeatured<T extends MockTourCard>(
  tours: readonly T[],
  featured?: boolean,
): T[] {
  if (featured === undefined) return [...tours];
  return tours.filter((tour) => tour.isFeatured === featured);
}

/** Tìm trên tiêu đề + tóm tắt + tên destination + tên chuyên mục, bỏ dấu cả hai
    phía. `summary` nullable nên phải hứng null trước khi ghép chuỗi. */
export function searchTours<T extends MockTourCard>(tours: readonly T[], query: string): T[] {
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
export function sortTours<T extends MockTourCard>(
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
export function relatedTours<T extends MockTourCard>(
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
