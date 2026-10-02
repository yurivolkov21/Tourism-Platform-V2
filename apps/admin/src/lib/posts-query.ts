import { type AdminPostsListQuery, POST_TITLE_MAX } from '@tourism/contract';
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
 * Trạng thái bảng `/posts` sống TRÊN URL (spec P4e-4 §4.2) — cùng khuôn
 * `enquiries-query.ts`: `?status=published|scheduled|draft`, `?q=` tìm theo tiêu đề, phân
 * trang của kit. Vắng `status` là tab All — mặc định thì không cần viết ra URL.
 */
export type PostsStatusTab = Exclude<AdminPostsListQuery['status'], 'all'>;

const STATUS_TABS: readonly PostsStatusTab[] = ['published', 'scheduled', 'draft'];

export interface PostsQuery {
  page: number;
  limit: number;
  status?: PostsStatusTab;
  search?: string;
}

/** Chữ bất kỳ → tab hợp lệ hoặc `null` — dùng cho cả URL lẫn giá trị của dải tab. */
export function parsePostsStatus(value: string | undefined): PostsStatusTab | null {
  return STATUS_TABS.find((tab) => tab === value) ?? null;
}

/** URL là thứ NGƯỜI gõ được: rác rơi về mặc định an toàn, không thành 400 ở API. */
export function parsePostsSearchParams(raw: RawSearchParams): PostsQuery {
  const status = parsePostsStatus(firstParam(raw.status));
  const search = clampSearch(firstParam(raw.q), POST_TITLE_MAX);
  return {
    ...parsePaging(raw),
    ...(status ? { status } : {}),
    ...(search ? { search } : {}),
  };
}

/** `undefined` = giữ nguyên, `null` = xoá bộ lọc (luật chung ở kit `pickPatch`). */
export interface PostsHrefPatch {
  page?: number;
  limit?: number;
  status?: PostsStatusTab | null;
  search?: string | null;
}

/** Đổi tab, ô tìm hay số dòng đều đặt lại trang về 1 (kit `resolvePagePatch`). */
export function postsHref(current: PostsQuery, patch: PostsHrefPatch): string {
  const scopeChanged =
    patch.status !== undefined || patch.search !== undefined || patch.limit !== undefined;
  const paging = resolvePagePatch(current, patch, scopeChanged);
  const status = pickPatch(patch.status, current.status);
  const search = clampSearch(pickPatch(patch.search, current.search), POST_TITLE_MAX);

  const params = new URLSearchParams();
  // Thứ tự param CỐ ĐỊNH để href ổn định giữa hai lần render.
  if (status) params.set('status', status);
  if (search) params.set('q', search);
  appendPaging(params, paging);
  return tableHref('/posts', params);
}

/** Input của `admin.posts.list`: vắng tab là `all`. */
export function toPostsListInput(query: PostsQuery): AdminPostsListQuery {
  return {
    page: query.page,
    limit: query.limit,
    status: query.status ?? 'all',
    ...(query.search ? { search: query.search } : {}),
  };
}
