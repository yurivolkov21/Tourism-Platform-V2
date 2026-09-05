import { isDefinedError, safe } from '@orpc/client';
import {
  type AdminBookingDetail,
  type AdminRefundInput,
  type AdminRefundResult,
  type Booking,
  BookingCodeSchema,
  type Paged,
} from '@tourism/contract';
import type { BookingsQuery } from '@/lib/bookings-query';
import { EXPORT_PAGE_SIZE, fetchAllPages, type PagedExport } from '@/lib/export-pages';
import { api, withAdminAuth } from './client';

/**
 * Ba đường của vùng bookings — bọc mỏng `admin.bookings.list` / `byCode`
 * (đọc, F1) và `refund` (ghi, F2). P4b KHÔNG thêm endpoint nào.
 */

/**
 * Một trang booking (TẤT CẢ khách, mới nhất trước — server đã orderBy). Input
 * là kết quả `parseBookingsSearchParams`, tức đã clamp/lọc xong.
 */
export async function fetchAdminBookings(
  cookie: string,
  // `includeMedia`/`signal` chỉ đường export-có-chọn dùng (vòng vá review
  // 02/09): nó lấy MỘT trang rồi giao theo mã, và cũng không cần ảnh.
  query: BookingsQuery & { includeMedia?: boolean },
  signal?: AbortSignal,
): Promise<Paged<Booking>> {
  return api.admin.bookings.list(query, {
    context: signal ? { cookie, signal } : withAdminAuth(cookie),
  });
}

/** Số hàng của bảng "Recent bookings" trên dashboard (ADR-0036 §3). */
export const RECENT_BOOKINGS_LIMIT = 10;

/**
 * Mười booking MỚI NHẤT cho dashboard `/` (ADR-0036 §3) — không lọc trạng
 * thái, không lọc ngày ("gần nhất" là gần nhất tuyệt đối, KHÔNG độn tháng
 * hiện tại như `/bookings`), server đã `orderBy createdAt desc`.
 * `includeMedia: false` vì bảng không có cột ảnh — cùng lý do đường export.
 */
export async function fetchRecentAdminBookings(cookie: string): Promise<Booking[]> {
  const paged = await api.admin.bookings.list(
    { page: 1, limit: RECENT_BOOKINGS_LIMIT, includeMedia: false },
    { context: withAdminAuth(cookie) },
  );
  return paged.items;
}

/**
 * TOÀN BỘ tập đang lọc, gom bằng cách lặp trang trên chính `admin.bookings.list`
 * (spec P4b §3-F6 — nguồn của nút Export CSV).
 *
 * Vòng lặp, ba chốt ngân sách (đợt song song · một mốc thời gian chung · trần
 * dòng) và luật dedupe nằm ở `lib/export-pages.ts` — nâng lên dùng chung ở
 * F10, khi subscribers thành consumer thứ hai của đúng vòng lặp mà vùng này
 * đã trả giá hai vòng review để viết đúng. Ở đây chỉ còn phần RIÊNG của
 * bookings: gọi endpoint nào, với bộ lọc gì, dedupe theo cột nào.
 *
 * `includeMedia: false` là chốt của riêng vùng này: file không có cột ảnh,
 * nên khỏi bắt API resolve media cho từng trang chỉ để vứt payload đi.
 */
export async function fetchAllAdminBookings(
  cookie: string,
  query: BookingsQuery,
): Promise<PagedExport<Booking>> {
  return fetchAllPages(
    (page, signal) =>
      api.admin.bookings.list(
        { ...query, page, limit: EXPORT_PAGE_SIZE, includeMedia: false },
        { context: { cookie, signal } },
      ),
    // Mã booking là khoá tự nhiên của hàng — cùng khoá mà cột checkbox dùng.
    (booking) => booking.code,
  );
}

/**
 * Chi tiết một booking theo code, kèm toàn bộ lịch sử cancellation (D1-B).
 * `null` = không có booking này để trang gọi `notFound()`; lỗi khác ném lại
 * cho error boundary (cùng khuôn `fetchBookingByCode` của web). KHÔNG bọc
 * React `cache()`: chỉ có một call site mỗi request (`generateMetadata` chỉ
 * đọc `params`, không fetch) — bản đầu F1 bọc với lời giải thích sai, gỡ ở
 * review 31/08.
 *
 * `code` đến thẳng từ URL nên soi định dạng TRƯỚC khi gọi API: chuỗi không
 * khớp `BK-XXXXXXXX` sẽ bị contract chặn thành BAD_REQUEST (không phải
 * defined error `NOT_FOUND`) và nổ ra trang 500 — với người dùng thì
 * "/bookings/foo" là 404, không phải lỗi hệ thống.
 */
export async function fetchAdminBookingByCode(
  cookie: string,
  code: string,
): Promise<AdminBookingDetail | null> {
  if (!BookingCodeSchema.safeParse(code).success) return null;
  const [error, data] = await safe(
    api.admin.bookings.byCode({ code }, { context: withAdminAuth(cookie) }),
  );
  if (error) {
    if (isDefinedError(error) && error.code === 'NOT_FOUND') return null;
    throw error;
  }
  return data;
}

/**
 * Refund (một phần) do admin phát — money-path (spec P4b §3-F2, ledger
 * ADR-0009). Bọc mỏng đúng như hai hàm đọc: KHÔNG nuốt lỗi ở đây.
 *
 * Sáu mã lỗi của contract (NOT_FOUND + năm mã 422/502) phải tới được UI
 * nguyên vẹn để mỗi mã có một câu riêng (bất biến spec §2.4), nên hàm này để
 * `ORPCError` ném thẳng lên; server action mới là chỗ phân loại
 * (`classifyRefundError`) — vì đó là biên cuối cùng còn giữ được kiểu lỗi.
 */
export async function refundAdminBooking(
  cookie: string,
  input: AdminRefundInput,
): Promise<AdminRefundResult> {
  // Trần 30s RIÊNG cho lệnh ghi tiền (mặc định link là 10s cho đường đọc):
  // refund gọi provider BÊN TRONG request; abort trong lúc API đã commit
  // ledger là kịch bản mở màn refund đúp (review F2 31/08). 30s ôm được p99
  // của provider; quá nữa thì đúng là không rõ — GENERIC xử theo lối
  // "đóng dialog + refresh" phía panel.
  return api.admin.bookings.refund(input, {
    context: { cookie, signal: AbortSignal.timeout(30_000) },
  });
}
