import { isDefinedError, safe } from '@orpc/client';
import {
  type AdminBookingDetail,
  type AdminRefundInput,
  type AdminRefundResult,
  type Booking,
  BookingCodeSchema,
  type Paged,
} from '@tourism/contract';
import { type BookingsQuery, EXPORT_MAX_ROWS } from '@/lib/bookings-query';
import { api, withAdminAuth } from './client';

// Re-export cho route/spec của đường export — bản gốc sống ở lib thuần
// `bookings-query.ts` vì nút Export (client) cũng cần đọc trần này.
export { EXPORT_MAX_ROWS };

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
 * ## Ngân sách của vòng gom (vòng vá review F6 lần 2)
 *
 * Rủi ro thật của "nhiều round-trip trong một route handler" đo bằng GIÂY chứ
 * không bằng dòng — trần 2000 dòng một mình không ngừa được nó (bản đầu hạ
 * 5000→2000 là chữa đúng bệnh nhưng sai đơn vị). Ba chốt hiện tại:
 *
 * - **Song song theo đợt** (`EXPORT_CONCURRENCY`): `totalPages` biết ngay sau
 *   trang đầu và trang 2..N không phụ thuộc nhau, nên 20 trang là ~4 đợt thay
 *   vì 20 lượt nối đuôi. Không phải MỘT `Promise.all` cả cụm: API trên Render
 *   dùng chung DB với đường khách, nện 19 request cùng lúc là tự bóp mình.
 * - **Một mốc thời gian CHUNG** (`EXPORT_TIME_BUDGET_MS`, thay cho timeout
 *   10s/lượt của link): 45s cho cả vòng, dưới `maxDuration = 60` mà hai route
 *   export khai — quá ngân sách thì abort ném vào `catch` của route và admin
 *   nhận 502 CÓ LỜI, chứ không phải đợi platform giết function giữa chừng và
 *   trả về một response cụt (thứ không bao giờ tái hiện được ở localhost).
 * - **`includeMedia: false`**: file không có cột ảnh, nên khỏi bắt API resolve
 *   media cho từng trang chỉ để vứt payload đi.
 *
 * Ngày nào tập dữ liệu thật sự lớn (chục nghìn booking) thì đường đúng là
 * endpoint stream ở API — lúc đó đọc lại đoạn này trước khi làm.
 */
export const EXPORT_PAGE_SIZE = 100; // trần `limit` của contract
/** Số trang gọi song song mỗi đợt — đủ nhanh mà không nện API thành bãi. */
export const EXPORT_CONCURRENCY = 5;
/** Ngân sách CHUNG cho cả vòng gom — phải nhỏ hơn `maxDuration` của route. */
export const EXPORT_TIME_BUDGET_MS = 45_000;

/** Kết quả gom: hoặc cả tập, hoặc lời từ chối kèm con số để báo cho người bấm. */
export type AdminBookingsExport =
  | { kind: 'rows'; bookings: Booking[] }
  | { kind: 'too-large'; total: number; max: number };

export async function fetchAllAdminBookings(
  cookie: string,
  query: BookingsQuery,
): Promise<AdminBookingsExport> {
  // MỘT mốc cho CẢ vòng (không phải 10s/lượt của link): xem "Ngân sách" trên.
  const budget = AbortSignal.timeout(EXPORT_TIME_BUDGET_MS);
  const fetchPage = (page: number) =>
    api.admin.bookings.list(
      { ...query, page, limit: EXPORT_PAGE_SIZE, includeMedia: false },
      { context: { cookie, signal: budget } },
    );

  // Trang đầu trả luôn `total` — biết ngay có nên đi tiếp hay không.
  const first = await fetchPage(1);
  if (first.total > EXPORT_MAX_ROWS) {
    return { kind: 'too-large', total: first.total, max: EXPORT_MAX_ROWS };
  }

  // Dedupe theo `code` (vòng vá review F6 lần 2): offset pagination trên một
  // list "mới nhất trước" đang TRÔI — một booking mới chen vào giữa hai lượt
  // đẩy mọi hàng lùi một vị trí, và hàng cuối trang trước quay lại đầu trang
  // sau. Không dedupe thì file có một mã nằm hai lần mà chẳng ai hay. (Chiều
  // ngược lại — một hàng bị đẩy RA khỏi lưới trang — thì không cứu được từ
  // client: file mô tả tập tại thời điểm bắt đầu xuất, và sổ sách kiểu này
  // luôn ghi rõ `generatedAt` thay vì hứa bất động.)
  const seen = new Set<string>();
  const bookings: Booking[] = [];
  const collect = (items: Booking[]) => {
    for (const item of items) {
      if (seen.has(item.code)) continue;
      seen.add(item.code);
      bookings.push(item);
    }
  };
  collect(first.items);

  // Trang 2..N theo ĐỢT `EXPORT_CONCURRENCY` trang song song; `totalPages`
  // chốt ở trang đầu — tập trôi giữa chừng không kéo dài được vòng lặp.
  for (let start = 2; start <= first.totalPages; start += EXPORT_CONCURRENCY) {
    const last = Math.min(start + EXPORT_CONCURRENCY - 1, first.totalPages);
    const batch = await Promise.all(
      Array.from({ length: last - start + 1 }, (_, i) => fetchPage(start + i)),
    );
    for (const paged of batch) collect(paged.items);
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
