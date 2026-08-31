/**
 * Phần DÙNG CHUNG của các bảng admin đọc-từ-server (spec P4b §2.2): trạng
 * thái danh sách sống TRÊN URL, server component đọc `searchParams` → input
 * contract, bảng client chỉ điều hướng chứ không fetch.
 *
 * Tách ra ở F3 theo đúng §2.1 ("kit mọc từ consumer đầu tiên, F3/F4 tiêu thụ
 * và ép tổng quát hoá"): `AdminBookingsListQuerySchema` và
 * `AdminCancellationsListQuerySchema` khai CÙNG một hình phân trang
 * (`page: z.int().min(1).default(1)`, `limit: z.int().min(1).max(100)
 * .default(20)`), nên luật clamp chỉ được có MỘT bản — hai bản là hai thứ sẽ
 * trôi lệch nhau. Phần RIÊNG của mỗi vùng (filter nào, đường dẫn nào) ở lại
 * `*-query.ts` của vùng đó.
 */

/** Hình dạng `searchParams` Next trao cho trang: một key có thể lặp thành mảng. */
export type RawSearchParams = Record<string, string | string[] | undefined>;

/** `limit` mặc định của hai schema list — giữ khớp với server. */
export const ADMIN_PAGE_SIZE = 20;

/** Trần `limit` của contract (`z.int().max(100)`) — vượt là 400 ở server. */
const PAGE_SIZE_MAX = 100;

/** Các mức cho ô "Rows per page" — cùng dãy với kit data-table dashboard-01. */
export const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50] as const;

/** Param lặp (`?page=2&page=9`) — lấy giá trị đầu, đúng nếp Next đọc query. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Phần phân trang của mọi query bảng admin.
 *
 * ⚠️ CẢNH BÁO CHO F4 (reviews): field tên `limit` vì HAI schema hiện tại
 * (bookings/cancellations) cùng dùng tên đó — nhưng `AdminReviewsQuerySchema`
 * extend `PageQuerySchema` với tên **`pageSize`**. Spread thẳng `{ page,
 * limit }` vào input reviews sẽ bị Zod STRIP IM LẶNG (object không strict):
 * pageSize rơi về default, "Rows per page" thành nút chết, không lỗi nào đỏ.
 * Vùng reviews PHẢI map tường minh: `{ page: paging.page, pageSize:
 * paging.limit }`.
 */
export interface TablePaging {
  page: number;
  limit: number;
}

/**
 * URL là thứ NGƯỜI gõ được: mọi giá trị rác phải rơi về mặc định an toàn chứ
 * không được ném lên tận API (400 vô nghĩa với admin).
 */
export function parsePaging(raw: RawSearchParams): TablePaging {
  const page = Number(firstParam(raw.page));
  const limit = Number(firstParam(raw.limit));

  return {
    // Number.isInteger loại luôn NaN/1.5/Infinity — chỉ số nguyên ≥ 1 sống sót.
    page: Number.isInteger(page) && page >= 1 ? page : 1,
    limit:
      Number.isInteger(limit) && limit >= 1 && limit <= PAGE_SIZE_MAX ? limit : ADMIN_PAGE_SIZE,
  };
}

/**
 * Ghi phân trang vào query đã mang sẵn filter của vùng. `page=1` và `limit`
 * mặc định KHÔNG xuất hiện — mặc định thì không cần viết ra URL.
 */
export function appendPaging(params: URLSearchParams, paging: TablePaging): void {
  if (paging.limit !== ADMIN_PAGE_SIZE) params.set('limit', String(paging.limit));
  if (paging.page > 1) params.set('page', String(paging.page));
}

/** Ghép đường dẫn với query — query rỗng thì không kèm dấu `?` cụt lủn. */
export function tableHref(pathname: string, params: URLSearchParams): string {
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/**
 * Luật chung của mọi hàm `*Href` (nâng từ cặp bản chép bookings/cancellations
 * ở review F3 31/08): đổi filter HOẶC số dòng mỗi trang đều ĐẶT LẠI trang về
 * 1 (trang 5 của bộ lọc cũ hầu như chắc chắn rỗng ở bộ mới), trừ khi chính
 * patch nói rõ trang nào. `scopeChanged` do vùng tính (nó biết filter của nó
 * là gì); hàm này chỉ giữ MỘT bản của luật để hai vùng không trôi lệch.
 */
export function resolvePagePatch(
  current: TablePaging,
  patch: { page?: number; limit?: number },
  scopeChanged: boolean,
): TablePaging {
  return {
    limit: patch.limit ?? current.limit,
    page: patch.page ?? (scopeChanged ? 1 : current.page),
  };
}
