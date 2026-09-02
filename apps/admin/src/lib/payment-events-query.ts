import { PaymentProviderSchema, type PaymentProviderValue } from '@tourism/contract';
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
 * Trạng thái bảng `/payment-events` sống TRÊN URL (spec P4c §3-F8, cùng
 * khuôn `outbox-query.ts`): server component đọc `searchParams` → input
 * contract; bảng client đổi trang/filter bằng điều hướng, KHÔNG fetch từ
 * browser.
 *
 * Bốn filter: `provider` (tab), `type` (Select liệt kê `PAYMENT_EVENT_TYPES`
 * nhưng nhận CHUỖI TỰ DO như contract — vòng vá review F8: cột DB là
 * varchar, gateway thêm type thứ năm thì `?type=` gõ tay vẫn phải lọc được;
 * Select tự thêm một mục cho giá trị ngoài tuple để không hiện nhầm "All"),
 * `q` (tìm eventId), `unprocessed` (toggle — `?unprocessed=true`). Phân trang
 * + luật patch/clamp dùng chung `table-query.ts`.
 */

/** Trần `search` của contract (`z.string().max(120)`). */
const SEARCH_MAX_LENGTH = 120;

/** Trần `type` của contract (`z.string().max(100)` — cột `varchar(100)`). */
const TYPE_MAX_LENGTH = 100;

/** Input đã sạch cho `admin.paymentEvents.list` (khớp AdminPaymentEventsListQuerySchema). */
export interface PaymentEventsQuery {
  page: number;
  limit: number;
  provider?: PaymentProviderValue;
  /** Chuỗi tự do đã trim/cắt trần — thường là một trong `PAYMENT_EVENT_TYPES`. */
  type?: string;
  search?: string;
  /** Chỉ có mặt khi `true` — cờ "chỉ hàng chưa xong", không phải trạng thái hai chiều. */
  unprocessed?: true;
}

/**
 * URL là thứ NGƯỜI gõ được: page rác → 1, provider ngoài enum → bỏ filter,
 * `type`/`q` rỗng → không lọc, quá dài → cắt đúng trần, `unprocessed`
 * chỉ nhận đúng chữ `true` (một cờ boolean không có "1"/"yes" — đó là chỗ
 * mà hai người đọc URL hiểu hai kiểu). Không ném 400 lên API.
 */
export function parsePaymentEventsSearchParams(raw: RawSearchParams): PaymentEventsQuery {
  const provider = PaymentProviderSchema.safeParse(firstParam(raw.provider));
  const type = clampSearch(firstParam(raw.type), TYPE_MAX_LENGTH);
  const search = clampSearch(firstParam(raw.q), SEARCH_MAX_LENGTH);
  const unprocessed = firstParam(raw.unprocessed) === 'true';

  return {
    ...parsePaging(raw),
    ...(provider.success ? { provider: provider.data } : {}),
    ...(type ? { type } : {}),
    ...(search ? { search } : {}),
    ...(unprocessed ? { unprocessed: true } : {}),
  };
}

/**
 * Sửa đổi mong muốn trên URL hiện tại. `undefined` = giữ nguyên field đó,
 * `null` = XOÁ filter. Riêng `unprocessed`: `false` cũng là xoá — cờ tắt thì
 * không có gì để ghi lên URL (`unprocessed=false` là một tham số vô nghĩa).
 */
export interface PaymentEventsHrefPatch {
  page?: number;
  limit?: number;
  provider?: PaymentProviderValue | null;
  type?: string | null;
  search?: string | null;
  unprocessed?: boolean | null;
}

/**
 * Dựng href mới từ trạng thái hiện tại + sửa đổi. Đổi filter HOẶC số dòng mỗi
 * trang đều ĐẶT LẠI trang về 1 (luật ở kit `resolvePagePatch`), trừ khi
 * chính patch nói rõ trang nào. Thứ tự param cố định để href ổn định.
 */
export function paymentEventsHref(
  current: PaymentEventsQuery,
  patch: PaymentEventsHrefPatch,
): string {
  const provider = pickPatch(patch.provider, current.provider);
  const type = clampSearch(pickPatch(patch.type, current.type), TYPE_MAX_LENGTH);
  const search = clampSearch(pickPatch(patch.search, current.search), SEARCH_MAX_LENGTH);
  const unprocessed = pickPatch(patch.unprocessed, current.unprocessed) === true;

  const scopeChanged =
    patch.provider !== undefined ||
    patch.type !== undefined ||
    patch.search !== undefined ||
    patch.unprocessed !== undefined ||
    patch.limit !== undefined;
  const paging = resolvePagePatch(current, patch, scopeChanged);

  const params = new URLSearchParams();
  if (provider) params.set('provider', provider);
  if (type) params.set('type', type);
  if (search) params.set('q', search);
  if (unprocessed) params.set('unprocessed', 'true');
  appendPaging(params, paging);

  return tableHref('/payment-events', params);
}
