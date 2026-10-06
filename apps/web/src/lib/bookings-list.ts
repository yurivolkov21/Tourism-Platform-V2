import type { BookingStatusValue, BookingWhen, ContractInputs } from '@tourism/contract';
import { BOOKINGS_SEARCH_MAX, BookingStatusSchema, BookingWhenSchema } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { listParam, type RawSearchParam, singleParam } from './search-params';

/**
 * Trạng thái của trang My bookings nằm TRỌN trên URL (spec P7 §2.7, ADR-0054 §4):
 * `?q=…&when=upcoming,past&status=paid&page=2`. File này đọc URL ấy, dựng lại nó, và dịch nó
 * thành input của `bookings.mine`. Giá trị lạ thì bỏ qua: URL gõ tay hay link cũ không được
 * làm sập trang (cùng bài học `search-params.ts`).
 */
export const BOOKINGS_LIST_PATH = '/account/bookings';

/** Id dòng đếm "N trips" ở đầu danh sách — sang trang thì tiêu điểm về đây (`TripPager`). */
export const BOOKINGS_COUNT_ID = 'bookings-count';

/** 10 đơn mỗi trang (spec §2.7) — khác mặc định 12 của contract; web luôn gửi tường minh. */
export const BOOKINGS_LIST_LIMIT = 10;

/** Gương trần `page` của `BookingsListQuerySchema` — vượt là 400 ở API. */
const PAGE_MAX = 10_000;

export interface BookingsListParams {
  /** Từ khoá đã cắt khoảng trắng và cắt trần; `null` là không tìm. */
  q: string | null;
  /** Theo thứ tự chuẩn của `BookingWhenSchema`, không trùng. */
  when: BookingWhen[];
  /** Theo thứ tự chuẩn của `BookingStatusSchema`, không trùng. */
  status: BookingStatusValue[];
  page: number;
}

export const EMPTY_BOOKINGS_LIST_PARAMS: BookingsListParams = {
  q: null,
  when: [],
  status: [],
  page: 1,
};

/** Chữ trong ô tìm → từ khoá gửi đi: cắt trần TRƯỚC, rồi cắt khoảng trắng; rỗng là `null`. */
export function searchTermOf(text: string): string | null {
  const term = text.trim().slice(0, BOOKINGS_SEARCH_MAX).trim();
  return term === '' ? null : term;
}

/** Một lần bấm chọn: có thì bỏ, chưa có thì thêm. Thứ tự do `bookingsListHref` chuẩn hoá. */
export function toggleValue<V>(list: readonly V[], value: V): V[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

/** Đang lọc hoặc đang tìm — quyết dòng "{n} of {total} trips" và nút Reset. */
export function hasListFilters(params: BookingsListParams): boolean {
  return params.q !== null || params.when.length > 0 || params.status.length > 0;
}

/** Giữ các giá trị hợp lệ theo thứ tự chuẩn của `options` — một bộ lọc, một chuỗi URL. */
function inOrder<V extends string>(values: Iterable<string>, options: readonly V[]): V[] {
  const picked = new Set(values);
  return options.filter((option) => picked.has(option));
}

/** `when=past,on_tour` → `['ON_TOUR', 'PAST']`; viết hoa để so với enum của contract. */
function parseList<V extends string>(raw: string | undefined, options: readonly V[]): V[] {
  if (raw === undefined) return [];
  return inOrder(
    raw.split(',').map((part) => part.trim().toUpperCase()),
    options,
  );
}

export function bookingsListParams(
  searchParams: Readonly<Record<string, RawSearchParam>>,
): BookingsListParams {
  const rawPage = singleParam(searchParams.page);
  const page = rawPage !== undefined && /^\d{1,5}$/.test(rawPage) ? Number(rawPage) : 1;
  return {
    q: searchTermOf(singleParam(searchParams.q) ?? ''),
    when: parseList(listParam(searchParams.when), BookingWhenSchema.options),
    status: parseList(listParam(searchParams.status), BookingStatusSchema.options),
    page: page >= 1 && page <= PAGE_MAX ? page : 1,
  };
}

export function bookingsListHref(params: BookingsListParams): string {
  const query = new URLSearchParams();
  if (params.q !== null) query.set('q', params.q);
  const when = inOrder(params.when, BookingWhenSchema.options);
  if (when.length > 0) query.set('when', when.map((value) => value.toLowerCase()).join(','));
  const status = inOrder(params.status, BookingStatusSchema.options);
  if (status.length > 0) {
    query.set('status', status.map((value) => value.toLowerCase()).join(','));
  }
  if (params.page > 1) query.set('page', String(params.page));
  // Dấu phẩy là sub-delim hợp lệ trong query (RFC 3986) — để nguyên cho link đọc được, cùng
  // nếp trang /tours; `URLSearchParams` đọc lại được cả hai dạng.
  const search = query.toString().replace(/%2C/g, ',');
  return search === '' ? BOOKINGS_LIST_PATH : `${BOOKINGS_LIST_PATH}?${search}`;
}

/** Bộ tham số của trang → input của `bookings.mine`: luôn `journey`, 10 dòng, bỏ khoá rỗng. */
export function bookingsListApiInput(
  params: BookingsListParams,
): ContractInputs['bookings']['mine'] {
  return {
    page: params.page,
    limit: BOOKINGS_LIST_LIMIT,
    order: 'journey',
    ...(params.when.length > 0 ? { when: params.when } : {}),
    ...(params.status.length > 0 ? { status: params.status } : {}),
    ...(params.q === null ? {} : { q: params.q }),
  };
}

/** Chữ và link của phân trang "Previous / Next" (spec §7.4). */
export interface PagerView {
  /** "Page 1 of 2 · trips 1–10 of 18". */
  summary: string;
  /** `null` ở trang đầu: nút Previous mờ, không bấm được. */
  previousHref: string | null;
  /** `null` ở trang cuối: không có Next. */
  next: { href: string; range: string } | null;
}

/** `null` khi dưới hai trang — thanh phân trang không hiện. Link giữ nguyên bộ lọc. */
export function pagerView(
  params: BookingsListParams,
  totalPages: number,
  total: number,
  limit: number,
): PagerView | null {
  if (totalPages < 2) return null;
  const tb = messages.accountBookings;
  const page = Math.min(Math.max(params.page, 1), totalPages);
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  return {
    summary: tb.pageSummary(page, totalPages, from, to, total),
    previousHref: page > 1 ? bookingsListHref({ ...params, page: page - 1 }) : null,
    next:
      page < totalPages
        ? {
            href: bookingsListHref({ ...params, page: page + 1 }),
            range: tb.nextRange(to + 1, Math.min(to + limit, total)),
          }
        : null,
  };
}
