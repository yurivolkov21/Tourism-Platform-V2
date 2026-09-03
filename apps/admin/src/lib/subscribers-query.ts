import { SUBSCRIBER_SOURCE_MAX_LENGTH } from '@tourism/contract';
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
 * Trạng thái bảng `/subscribers` sống TRÊN URL (spec P4c §3-F10, cùng khuôn
 * `enquiries-query.ts`/`outbox-query.ts`): server component đọc `searchParams`
 * → input contract; bảng client đổi trang/lọc bằng điều hướng, KHÔNG fetch từ
 * browser.
 *
 * Ba filter: `active` (tab Active/Unsubscribed/All), `q` (tìm email) và
 * `source` (Select dựng từ chính `sources` mà response trả về).
 *
 * `active` là chỗ vùng này KHÁC ba vùng trước, và khác một cách dễ sai: nó
 * là cờ BA TRẠNG THÁI chứ không phải một filter bật/tắt. `false` KHÔNG đồng
 * nghĩa "không lọc" — nó là tab "Unsubscribed", một tập người ta thật sự
 * muốn xem — nên nó phải ghi được ra URL, ngược hẳn với `unprocessed` của
 * payment events (cờ tắt thì không có gì để viết). Mọi phép so ở đây vì thế
 * là `=== true` / `=== false`, không bao giờ truthy.
 *
 * MẶC ĐỊNH là Active ở TẦNG PARSE (vòng vá review F10): URL không nói gì
 * (`/subscribers` trần — bookmark, redirect sau đăng nhập) là tab Active,
 * còn tab All phải được viết TƯỜNG MINH `?active=all`. Bản đầu chỉ đặt mặc
 * định ở href của nav, nên một bookmark trần rơi vào All và nút Export ở đó
 * dựng file gồm cả địa chỉ đã rút consent — tập PII rộng nhất, không ai cố
 * ý chọn. Cùng luật cho trang lẫn route export (chung một hàm parse).
 */

/** Trần `search` của contract (`z.string().max(120)`). */
const SEARCH_MAX_LENGTH = 120;

/** Input đã sạch cho `admin.subscribers.list` (khớp AdminSubscribersListQuerySchema). */
export interface SubscribersQuery {
  page: number;
  limit: number;
  /** `true` = còn nhận tin · `false` = đã huỷ · vắng = mọi hàng. */
  active?: boolean;
  search?: string;
  source?: string;
}

/** Giá trị URL của tab All — tường minh, vì vắng mặt nghĩa là Active. */
const ACTIVE_ALL_PARAM = 'all';

/**
 * URL là thứ NGƯỜI gõ được: page rác → 1, `active` vắng/"true"/rác → tab
 * Active (mặc định), "false" → tab Unsubscribed, "all" → mọi hàng; `q`/`source`
 * rỗng → không lọc và quá dài thì cắt đúng trần. Không ném 400 lên API.
 *
 * `active` cố ý KHÔNG nhận "1"/"yes"/"on": một cờ ba trạng thái mà mỗi người
 * viết URL một kiểu là chỗ hai người đọc cùng một link ra hai bảng khác nhau
 * — rác rơi về mặc định AN TOÀN (tập hẹp nhất), không rơi về All.
 */
export function parseSubscribersSearchParams(raw: RawSearchParams): SubscribersQuery {
  const active = firstParam(raw.active);
  const search = clampSearch(firstParam(raw.q), SEARCH_MAX_LENGTH);
  const source = clampSearch(firstParam(raw.source), SUBSCRIBER_SOURCE_MAX_LENGTH);

  return {
    ...parsePaging(raw),
    ...(active === ACTIVE_ALL_PARAM ? {} : { active: active !== 'false' }),
    ...(search ? { search } : {}),
    ...(source ? { source } : {}),
  };
}

/**
 * Sửa đổi mong muốn trên URL hiện tại. `undefined` = giữ nguyên field đó,
 * `null` = XOÁ filter — hai ý nghĩa khác nhau nên không gộp được (luật chung
 * ở kit `pickPatch`). Với `active`, `false` là một GIÁ TRỊ (tab Unsubscribed),
 * không phải cách nói "xoá".
 */
export interface SubscribersHrefPatch {
  page?: number;
  limit?: number;
  active?: boolean | null;
  search?: string | null;
  source?: string | null;
}

/**
 * Dựng href mới từ trạng thái hiện tại + sửa đổi. Đổi filter HOẶC số dòng mỗi
 * trang đều ĐẶT LẠI trang về 1 (luật ở kit `resolvePagePatch`), trừ khi chính
 * patch nói rõ trang nào. Thứ tự param cố định để href ổn định.
 */
export function subscribersHref(current: SubscribersQuery, patch: SubscribersHrefPatch): string {
  const scopeChanged =
    patch.active !== undefined ||
    patch.search !== undefined ||
    patch.source !== undefined ||
    patch.limit !== undefined;
  const paging = resolvePagePatch(current, patch, scopeChanged);

  const params = new URLSearchParams();
  appendFilters(params, resolveFilters(current, patch));
  appendPaging(params, paging);

  return tableHref('/subscribers', params);
}

/**
 * Link tải CSV — trỏ tới route handler `/subscribers/export`.
 *
 * Cố ý BỎ `page`/`limit`: file là CẢ TẬP đang lọc chứ không phải trang đang
 * xem (cùng lời hứa với `bookingsExportHref`). Vùng này KHÔNG có xuất
 * theo-lựa-chọn — không có cột checkbox, nên không có `sel`.
 */
export function subscribersExportHref(query: SubscribersQuery): string {
  const params = new URLSearchParams();
  appendFilters(params, query);
  return tableHref('/subscribers/export', params);
}

/** Ba filter sau khi áp patch — một chỗ để hai hàm href không trôi lệch. */
function resolveFilters(
  current: SubscribersQuery,
  patch: SubscribersHrefPatch,
): Pick<SubscribersQuery, 'active' | 'search' | 'source'> {
  return {
    active: pickPatch(patch.active, current.active),
    search: clampSearch(pickPatch(patch.search, current.search), SEARCH_MAX_LENGTH),
    source: clampSearch(pickPatch(patch.source, current.source), SUBSCRIBER_SOURCE_MAX_LENGTH),
  };
}

/**
 * Ghi ba filter vào query theo THỨ TỰ CỐ ĐỊNH — href ổn định giữa hai render.
 * Gương của `parseSubscribersSearchParams`: Active (mặc định) không viết ra
 * URL, Unsubscribed là `active=false`, All là `active=all` TƯỜNG MINH.
 */
function appendFilters(
  params: URLSearchParams,
  query: Pick<SubscribersQuery, 'active' | 'search' | 'source'>,
): void {
  if (query.active === undefined) params.set('active', ACTIVE_ALL_PARAM);
  else if (query.active === false) params.set('active', 'false');
  if (query.search) params.set('q', query.search);
  if (query.source) params.set('source', query.source);
}
