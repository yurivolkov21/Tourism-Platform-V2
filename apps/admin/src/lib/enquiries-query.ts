import { EnquiryStatusSchema, type EnquiryStatusValue } from '@tourism/contract';
import { z } from 'zod';
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
 * Trạng thái bảng `/enquiries` sống TRÊN URL (spec P4c §3-F9, cùng khuôn
 * `outbox-query.ts`/`payment-events-query.ts`): server component đọc
 * `searchParams` → input contract; bảng client đổi trang/lọc bằng điều hướng,
 * KHÔNG fetch từ browser.
 *
 * Ba filter: `status` (tab năm trạng thái + All — nav trỏ `?status=NEW` vì đó
 * là việc cần làm, cùng nếp `/cancellations?status=REQUESTED`), `q` (tìm
 * name/email) và `tourId`. `tourId` KHÔNG có control trên toolbar (quyết định
 * tự chọn F9: chưa có endpoint list tour cho admin tới P4e, nên một Select
 * sẽ phải hardcode danh sách tour) — nhưng nó phải parse thật để URL đi từ
 * nơi khác lọc được, và bảng hiện một chip gỡ được cho nó.
 */

/** Trần `search` của contract (`z.string().max(120)`). */
const SEARCH_MAX_LENGTH = 120;

/** `tourId` là uuid ở contract — chuỗi khác là 400, nên chặn ngay tại đây. */
const TourIdSchema = z.uuid();

/** Input đã sạch cho `admin.enquiries.list` (khớp AdminEnquiriesListQuerySchema). */
export interface EnquiriesQuery {
  page: number;
  limit: number;
  status?: EnquiryStatusValue;
  search?: string;
  tourId?: string;
}

/**
 * URL là thứ NGƯỜI gõ được: page rác → 1, status ngoài enum (kể cả trạng thái
 * dán nhầm từ `/bookings`) → bỏ filter, `q` rỗng → không lọc và quá dài thì
 * cắt đúng trần, `tourId` không phải uuid → bỏ. Không ném 400 lên API.
 */
export function parseEnquiriesSearchParams(raw: RawSearchParams): EnquiriesQuery {
  const status = EnquiryStatusSchema.safeParse(firstParam(raw.status));
  const search = clampSearch(firstParam(raw.q), SEARCH_MAX_LENGTH);
  const tourId = TourIdSchema.safeParse(firstParam(raw.tourId));

  return {
    ...parsePaging(raw),
    ...(status.success ? { status: status.data } : {}),
    ...(search ? { search } : {}),
    ...(tourId.success ? { tourId: tourId.data } : {}),
  };
}

/**
 * Sửa đổi mong muốn trên URL hiện tại. `undefined` = giữ nguyên field đó,
 * `null` = XOÁ filter — hai ý nghĩa khác nhau nên không gộp được (luật chung
 * ở kit `pickPatch`).
 */
export interface EnquiriesHrefPatch {
  page?: number;
  limit?: number;
  status?: EnquiryStatusValue | null;
  search?: string | null;
  tourId?: string | null;
}

/**
 * Dựng href mới từ trạng thái hiện tại + sửa đổi. Đổi filter HOẶC số dòng mỗi
 * trang đều ĐẶT LẠI trang về 1 (luật ở kit `resolvePagePatch`), trừ khi chính
 * patch nói rõ trang nào. Thứ tự param cố định để href ổn định.
 */
export function enquiriesHref(current: EnquiriesQuery, patch: EnquiriesHrefPatch): string {
  const status = pickPatch(patch.status, current.status);
  const search = clampSearch(pickPatch(patch.search, current.search), SEARCH_MAX_LENGTH);
  const tourId = pickPatch(patch.tourId, current.tourId);

  const scopeChanged =
    patch.status !== undefined ||
    patch.search !== undefined ||
    patch.tourId !== undefined ||
    patch.limit !== undefined;
  const paging = resolvePagePatch(current, patch, scopeChanged);

  const params = new URLSearchParams();
  if (status) params.set('status', status);
  if (search) params.set('q', search);
  if (tourId) params.set('tourId', tourId);
  appendPaging(params, paging);

  return tableHref('/enquiries', params);
}
