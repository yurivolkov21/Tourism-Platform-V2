import { isDefinedError, safe } from '@orpc/client';
import type { ContractOutputs } from '@tourism/contract';
import { cache } from 'react';
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
  return data;
});

/**
 * Review đã duyệt của một tour, phân trang. Input `ReviewsByTourQuerySchema`
 * dùng field `page`/`pageSize` (kế thừa `PageQuerySchema`) — KHÔNG phải
 * `limit` như `tours.list`. Gắn `tourTag(slug)`: bust một tour không đụng
 * cache review của tour khác.
 */
export async function fetchTourReviews(
  slug: string,
  page = 1,
): Promise<ContractOutputs['reviews']['listByTour']> {
  return api.reviews.listByTour(
    { tourSlug: slug, page },
    { context: { next: { revalidate: REVALIDATE_SEC, tags: [tourTag(slug)] } } },
  );
}
