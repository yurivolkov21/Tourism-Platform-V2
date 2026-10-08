import type {
  BookingStatusValue,
  BookingsListFacets,
  BookingsListOrder,
  BookingWhen,
} from '@tourism/contract';
import { bookingPhase, bookingWhen, foldAccents } from '@tourism/contract';

/**
 * Lọc, tìm, xếp, đếm và cắt trang của `bookings.mine` (ADR-0054 §2–3) — hàm THUẦN trên tập
 * khoá nhẹ của mọi đơn của MỘT khách. Service đọc khoá, gọi `selectBookingsPage`, rồi mới
 * nạp đủ dữ liệu cho đúng các id của trang. Tách khỏi service để test không cần DB.
 *
 * Không làm bằng SQL (ADR-0054 "Phương án đã loại"): luật giai đoạn ở contract là MỘT bản
 * cho cả web, còn bỏ dấu tiếng Việt cần extension `unaccent` mà DB chưa bật. Khách nhiều đơn
 * nhất trên prod có 14 đơn (05/10) — đọc hết rồi xếp ở đây không đáng kể.
 */

/** Phần nhẹ của một đơn mà lọc, tìm, xếp và đếm cần. */
export interface BookingListKey {
  id: string;
  code: string;
  status: BookingStatusValue;
  createdAt: Date;
  /** Ngày lịch `YYYY-MM-DD` (snapshot lúc đặt). */
  departureStartDate: string;
  departureEndDate: string;
  /** Mốc huỷ thật dạng ISO, null khi chưa từng huỷ thật — `bookingPhase` cần (ADR-0054 AMEND 1). */
  cancelledAt: string | null;
  /** Chuyến bị công ty huỷ, đọc sống từ trạng thái chuyến (ADR-0054 AMEND 1). */
  departureCancelled: boolean;
  /** Snapshot tên tour lúc đặt — đúng chữ khách thấy trên dòng của mình. */
  tourTitle: string;
  /** Tên các điểm đến của tour, đọc sống như `tourDestinations` của `toBooking`. */
  destinationNames: readonly string[];
}

/** Bộ lọc của một lần gọi — cùng cấu trúc `BookingsListQuery` của contract. */
export interface BookingListFilter {
  page: number;
  limit: number;
  order: BookingsListOrder;
  when?: readonly BookingWhen[];
  /** Một giá trị (cú pháp cũ `status=PAID`) hoặc nhiều. */
  status?: BookingStatusValue | readonly BookingStatusValue[];
  q?: string;
}

export interface BookingListSelection {
  /** Id của trang được hỏi, đúng thứ tự hiển thị. */
  pageIds: string[];
  /** Số đơn khớp bộ lọc, trước khi cắt trang. */
  total: number;
  /** Đếm trên TOÀN BỘ đơn, bỏ qua bộ lọc (ADR-0054 §2). */
  facets: BookingsListFacets;
  /** Tổng đơn của khách, không lọc. */
  overallTotal: number;
}

/**
 * Khoá so khớp của ô tìm: bỏ dấu và hạ chữ thường bằng `foldAccents`, rồi bỏ MỌI ký tự không
 * phải chữ hoặc số. Bước cuối làm "hanoi" khớp "Hà Nội" và "bk b6vc" khớp "BK-B6VCOQNW":
 * ADR-0054 §3 hứa cả "ha noi" lẫn "hanoi" đều ra tour Hà Nội — chỉ bỏ dấu thì "hanoi" chỉ
 * khớp khi tên tour tình cờ viết liền.
 */
export function searchKey(value: string): string {
  return foldAccents(value).replace(/[^a-z0-9]/g, '');
}

/** Đơn có khớp từ khoá không: mã đơn, tên tour, hay tên một điểm đến. */
export function matchesSearch(key: BookingListKey, q: string): boolean {
  const needle = searchKey(q);
  // Từ khoá toàn ký hiệu ("!!!") không còn gì để so: không khớp đơn nào, thay vì khớp tất cả.
  if (needle === '') return false;
  return [key.code, key.tourTitle, ...key.destinationNames].some((text) =>
    searchKey(text).includes(needle),
  );
}

/** Hạng nhóm của thứ tự `journey`: đang đi → sắp đi → đã qua. */
const JOURNEY_RANK: Readonly<Record<BookingWhen, number>> = { ON_TOUR: 0, UPCOMING: 1, PAST: 2 };

interface PlacedKey {
  key: BookingListKey;
  when: BookingWhen;
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Hoà: tạo sau đứng trước, rồi id tăng dần — đúng khoá phụ `createdAt desc, id asc` cũ. */
function compareTie(a: BookingListKey, b: BookingListKey): number {
  return b.createdAt.getTime() - a.createdAt.getTime() || compareText(a.id, b.id);
}

function compareRecent(a: PlacedKey, b: PlacedKey): number {
  return compareTie(a.key, b.key);
}

/**
 * `journey` (ADR-0054 §3): xếp theo hạng nhóm; trong `ON_TOUR` và `UPCOMING` ngày đi TĂNG dần
 * (việc gần nhất trước), trong `PAST` ngày đi GIẢM dần (ký ức gần nhất trước).
 */
function compareJourney(a: PlacedKey, b: PlacedKey): number {
  const rank = JOURNEY_RANK[a.when] - JOURNEY_RANK[b.when];
  if (rank !== 0) return rank;
  const byStart = compareText(a.key.departureStartDate, b.key.departureStartDate);
  return (a.when === 'PAST' ? -byStart : byStart) || compareTie(a.key, b.key);
}

/** `status` một giá trị hoặc mảng → tập; `null` là không lọc. */
function statusSet(status: BookingListFilter['status']): ReadonlySet<BookingStatusValue> | null {
  if (status === undefined) return null;
  return new Set(typeof status === 'string' ? [status] : status);
}

export function selectBookingsPage(
  keys: readonly BookingListKey[],
  filter: BookingListFilter,
  today: string,
): BookingListSelection {
  // Đủ mọi khoá ngay từ đầu: contract đòi record ĐỦ (lựa chọn không có đơn vẫn là 0).
  const facets: BookingsListFacets = {
    when: { ON_TOUR: 0, UPCOMING: 0, PAST: 0 },
    status: { PENDING: 0, PAID: 0, CANCELLED: 0, REFUNDED: 0, PARTIALLY_REFUNDED: 0 },
  };
  const placed = keys.map((key): PlacedKey => {
    const when = bookingWhen(bookingPhase(key, today));
    facets.when[when] += 1;
    facets.status[key.status] += 1;
    return { key, when };
  });

  const whens = filter.when === undefined ? null : new Set(filter.when);
  const statuses = statusSet(filter.status);
  const matched = placed.filter(
    ({ key, when }) =>
      (whens === null || whens.has(when)) &&
      (statuses === null || statuses.has(key.status)) &&
      (filter.q === undefined || matchesSearch(key, filter.q)),
  );
  matched.sort(filter.order === 'journey' ? compareJourney : compareRecent);

  const start = (filter.page - 1) * filter.limit;
  return {
    pageIds: matched.slice(start, start + filter.limit).map(({ key }) => key.id),
    total: matched.length,
    facets,
    overallTotal: keys.length,
  };
}
