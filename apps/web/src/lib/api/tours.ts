import { isDefinedError, safe } from '@orpc/client';
import type { ContractInputs, ContractOutputs } from '@tourism/contract';
import { cache } from 'react';
import { resolveDepartureAnchors } from '@/lib/tour-detail';
import { api } from './client';
import { TAGS, tourTag } from './tags';

/**
 * VM = type contract THẲNG (không map field): mock ở `mocks/types.ts` đã
 * gương đúng `TourCardSchema`/`TourDetailSchema`/`PublicReviewSchema` từ trước
 * (quy ước static-first §"NGOẠI LỆ") nên không có mapper thuần nào để viết —
 * khác cụm blog (`toJournalPost`/`toJournalPostDetail` đổi tên field/derive
 * `readMinutes`). Lấy type qua `ContractOutputs['catalog']['tours']…` (xuất
 * sẵn ở `libs/shared/contract/src/index.ts`) thay vì `z.output<typeof …>` để
 * khỏi phải import thêm schema — cùng dữ liệu, đường ngắn hơn.
 */
export type TourCardVM = ContractOutputs['catalog']['tours']['list']['items'][number];
export type TourDetailVM = ContractOutputs['catalog']['tours']['bySlug'];
export type TourReviewVM = ContractOutputs['reviews']['listByTour']['items'][number];
/** VM facet destination cho sidebar lọc — cùng shape `MockDestination` (mock đã
    gương đúng `DestinationSchema` từ trước), đặt tên VM ở đây cho nhất quán với
    ba type trên khi ToursExplorer/ToursFilters đổi nguồn sang API thật. */
export type DestinationVM = ContractOutputs['catalog']['destinations']['list'][number];
/** Một đợt khởi hành trong `TourDetailVM.departures` — tách riêng để component
    nhận dữ liệu THẲNG từ `fetchTourDetail()` (`departure-selection.tsx`/
    `booking-rail.tsx`) khai prop theo VM thay vì mượn `MockTourDeparture`
    (mocks/tours.ts đã khai tử ở Task 7). `departure-strip.tsx` vẫn nhận qua
    context của `departure-selection.tsx` nên KHÔNG cần đổi — `MockTourDeparture`
    còn sống ở `mocks/types.ts` đúng vì file đó (`departures-table.tsx` xoá
    13/08). */
export type DepartureVM = TourDetailVM['departures'][number];
/** Một ngày trong `TourDetailVM.itinerary` — cùng lý do tách như `DepartureVM`. */
export type ItineraryDayVM = TourDetailVM['itinerary'][number];

const REVALIDATE_SEC = 300; // ADR-0016 §3 — con số Nexora đã vận hành, cùng revalidate cụm blog

/**
 * Danh sách tour published. `limit: 50` (KHÔNG phải `pageSize` — field của
 * `ToursListQuerySchema` là `limit`, max 50) đủ cho 30 tour seed trong MỘT
 * call. Gắn `TAGS.TOURS` để revalidate theo taxonomy chung.
 */
export async function fetchTours(): Promise<TourCardVM[]> {
  const page = await api.catalog.tours.list(
    { page: 1, limit: 50 },
    { context: { next: { revalidate: REVALIDATE_SEC, tags: [TAGS.TOURS] } } },
  );
  return page.items;
}

/**
 * Danh sách destination — nuôi cả facet lọc ở trang listing lẫn cụm
 * `/destinations` + navbar (menu vùng/địa điểm), đi cùng vòng đời `TAGS.TOURS`
 * (số tour đã publish/destination đổi theo cùng nhịp với danh sách tour).
 */
export async function fetchDestinations(): Promise<
  ContractOutputs['catalog']['destinations']['list']
> {
  return api.catalog.destinations.list(undefined, {
    context: { next: { revalidate: REVALIDATE_SEC, tags: [TAGS.TOURS] } },
  });
}

/**
 * Chi tiết một tour theo slug. Bọc React `cache()` như `fetchPostDetail` —
 * `generateMetadata` và thân trang gọi cùng slug trong một request chỉ tốn
 * một fetch. Trả `null` CHỈ khi lỗi định danh `NOT_FOUND` (contract.ts:101,
 * KHÁC `POST_NOT_FOUND` của blog) — nhánh 404 hợp lệ, page gọi `notFound()`;
 * mọi lỗi khác ném lại cho error boundary.
 */
export const fetchTourDetail = cache(async (slug: string): Promise<TourDetailVM | null> => {
  const [error, data] = await safe(
    api.catalog.tours.bySlug(
      { slug },
      { context: { next: { revalidate: REVALIDATE_SEC, tags: [tourTag(slug)] } } },
    ),
  );
  if (error) {
    if (isDefinedError(error) && error.code === 'NOT_FOUND') return null;
    throw error;
  }
  // Một giá gạch duy nhất cho mỗi đợt (sweep giá 19/08) — áp Ở ĐÂY để mọi bề
  // mặt của trang chi tiết (hero, panel ảnh, rail, strip, bảng, modal) cùng
  // đọc một con số; lý do đầy đủ ở `resolveDepartureAnchors`.
  return resolveDepartureAnchors(data);
});

/**
 * Review đã duyệt của một tour, phân trang. Input `ReviewsByTourQuerySchema`
 * dùng field `page`/`pageSize` (kế thừa `PageQuerySchema`) — KHÔNG phải
 * `limit` như `tours.list`. Gắn `tourTag(slug)`: bust một tour không đụng
 * cache review của tour khác.
 */
export type TourReviewsPageVM = ContractOutputs['reviews']['listByTour'];

/** Bộ lọc/sắp xếp của modal "Show all reviews" — cùng field với
    `ReviewsByTourQuerySchema`, để trống thì server áp mặc định (`newest`). */
export interface TourReviewsQuery {
  page?: number;
  pageSize?: number;
  sort?: ContractInputs['reviews']['listByTour']['sort'];
  rating?: number;
  withPhotos?: boolean;
}

export async function fetchTourReviews(
  slug: string,
  query: TourReviewsQuery = {},
): Promise<TourReviewsPageVM> {
  return api.reviews.listByTour(
    { tourSlug: slug, page: 1, ...query },
    { context: { next: { revalidate: REVALIDATE_SEC, tags: [tourTag(slug)] } } },
  );
}

/**
 * Cùng endpoint, gọi TỪ BROWSER: modal review nạp lại mỗi lần khách đổi sắp xếp
 * hoặc bộ lọc, và những lần đó không đi qua server render nào cả.
 *
 * KHÔNG gắn `next: { revalidate, tags }` — hai option đó chỉ có nghĩa với
 * `fetch` phía server của Next; gửi kèm từ browser là rác. Cũng không cần
 * cookie: review đã duyệt là dữ liệu công khai.
 */
export async function fetchTourReviewsFromBrowser(
  slug: string,
  query: TourReviewsQuery = {},
): Promise<TourReviewsPageVM> {
  return api.reviews.listByTour({ tourSlug: slug, page: 1, ...query });
}
