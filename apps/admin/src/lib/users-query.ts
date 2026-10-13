import { AdminUsersViewSchema, USER_SEARCH_MAX } from '@tourism/contract';
import {
  appendPaging,
  clampSearch,
  firstParam,
  parsePaging,
  pickPatch,
  type RawSearchParams,
  resolvePagePatch,
  tableHref,
} from './table-query';

/**
 * Trạng thái bảng `/users` sống TRÊN URL (P4f, cùng khuôn `enquiries-query.ts`): server
 * component đọc `searchParams` → input contract; bảng client đổi trang/lọc bằng điều hướng.
 * Hai filter: `view` (tab All · Staff · Locked; vắng = All) và `q` (tên hoặc email).
 */

export type UsersFilterView = 'staff' | 'locked';

/** Input đã sạch cho `admin.users.list` — vắng `view` = API mặc định `all`. */
export interface UsersQuery {
  page: number;
  limit: number;
  view?: UsersFilterView;
  search?: string;
}

/** URL là thứ NGƯỜI gõ được: view rác → All, q rỗng → không lọc, quá dài → cắt đúng trần. */
export function parseUsersSearchParams(raw: RawSearchParams): UsersQuery {
  const view = AdminUsersViewSchema.safeParse(firstParam(raw.view));
  const search = clampSearch(firstParam(raw.q), USER_SEARCH_MAX);
  return {
    ...parsePaging(raw),
    ...(view.success && view.data !== 'all' ? { view: view.data } : {}),
    ...(search ? { search } : {}),
  };
}

/** `undefined` = giữ nguyên field, `null` = xoá filter (luật chung của kit `pickPatch`). */
export interface UsersHrefPatch {
  page?: number;
  limit?: number;
  view?: UsersFilterView | null;
  search?: string | null;
}

export function usersHref(current: UsersQuery, patch: UsersHrefPatch): string {
  const view = pickPatch(patch.view, current.view);
  const search = clampSearch(pickPatch(patch.search, current.search), USER_SEARCH_MAX);
  const scopeChanged =
    patch.view !== undefined || patch.search !== undefined || patch.limit !== undefined;
  const paging = resolvePagePatch(current, patch, scopeChanged);

  const params = new URLSearchParams();
  if (view) params.set('view', view);
  if (search) params.set('q', search);
  appendPaging(params, paging);
  return tableHref('/users', params);
}

const DEFAULT_BACK_HREF = '/users';

/** Link sang trang chi tiết, mang `?back=` khi danh sách đang đứng khác URL trần. */
export function userDetailHref(id: string, listHref: string): string {
  const params = new URLSearchParams();
  if (listHref !== DEFAULT_BACK_HREF) params.set('back', listHref);
  return tableHref(`/users/${id}`, params);
}

/** `?back=` chỉ được trỏ về chính `/users` — mọi thứ khác về URL trần (chống open redirect). */
export function usersBackHref(raw: string | string[] | undefined): string {
  const value = firstParam(raw);
  if (value && /^\/users(\?[^/#]*)?$/.test(value)) return value;
  return DEFAULT_BACK_HREF;
}
