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
  query: BookingsQuery,
): Promise<Paged<Booking>> {
  return api.admin.bookings.list(query, { context: withAdminAuth(cookie) });
}

/**
 * TOÀN BỘ tập đang lọc, gom bằng cách lặp trang trên chính `admin.bookings.list`
 * (spec P4b §3-F6 — nguồn của nút Export CSV).
 *
 * ## Vì sao lặp trang từ admin, không phải một endpoint stream ở API
 *
 * Cân nhắc hai đường, chọn đường này:
 *
 * - CSV là chuyện TRÌNH BÀY, không phải chuyện dữ liệu. `admin.bookings.list`
 *   đã trả đúng tập cần; thêm một endpoint `text/csv` vào API nghĩa là mở
 *   endpoint KHÔNG-JSON đầu tiên của một contract oRPC toàn JSON, cộng guard
 *   riêng, cộng int test riêng — tất cả chỉ để đổi định dạng.
 * - Route handler admin đã có sẵn cookie forward (nếp `session.ts`) và chạy
 *   trên server, nên không có bí mật nào rời khỏi server.
 * - Giá phải trả: N round-trip thay vì một stream, và cả tập nằm trong RAM
 *   một lúc. Ở cỡ back-office này (hàng trăm booking) đó là 1–2 request; trần
 *   `EXPORT_MAX_ROWS` chặn trường hợp tập phình to, và route handler TỪ CHỐI
 *   (413) chứ không cắt bớt im lặng — một file thiếu hàng mà không ai biết là
 *   thứ tệ hơn hẳn một thông báo.
 *
 * Vì sao trần là 2000 chứ không lớn hơn (hạ từ 5000 ở vòng vá review F6):
 * cả vòng lặp chạy TRONG MỘT route handler, mà admin deploy lên Vercel
 * (ADR-0026) nơi function có trần thời lượng. 2000 dòng = tối đa 20 round-trip
 * sang API trên Render; 5000 là 50 round-trip và đủ để chạm trần đó — kết cục
 * là request bị cắt giữa chừng, trình duyệt nhận một response hỏng thay vì
 * file, và KHÔNG tái hiện được ở localhost.
 *
 * Ngày nào tập dữ liệu thật sự lớn (chục nghìn booking) thì đường đúng là
 * endpoint stream ở API — lúc đó đọc lại đoạn này trước khi làm.
 */
export const EXPORT_PAGE_SIZE = 100; // trần `limit` của contract
export const EXPORT_MAX_ROWS = 2000;

/** Kết quả gom: hoặc cả tập, hoặc lời từ chối kèm con số để báo cho người bấm. */
export type AdminBookingsExport =
  | { kind: 'rows'; bookings: Booking[] }
  | { kind: 'too-large'; total: number; max: number };

export async function fetchAllAdminBookings(
  cookie: string,
  query: BookingsQuery,
): Promise<AdminBookingsExport> {
  // Trang đầu trả luôn `total` — biết ngay có nên đi tiếp hay không.
  const first = await fetchAdminBookings(cookie, {
    ...query,
    page: 1,
    limit: EXPORT_PAGE_SIZE,
  });
  if (first.total > EXPORT_MAX_ROWS) {
    return { kind: 'too-large', total: first.total, max: EXPORT_MAX_ROWS };
  }

  const bookings = [...first.items];
  for (let page = 2; page <= first.totalPages; page++) {
    const next = await fetchAdminBookings(cookie, { ...query, page, limit: EXPORT_PAGE_SIZE });
    bookings.push(...next.items);
    // `totalPages` được chốt ở trang đầu; nếu ai đó tạo booking mới giữa
    // chừng thì trang cuối có thể ngắn hơn — dừng ở đây là ĐÚNG, file mô tả
    // tập tại thời điểm bắt đầu xuất chứ không phải một tập đang trôi.
    if (next.items.length === 0) break;
  }
  return { kind: 'rows', bookings };
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
