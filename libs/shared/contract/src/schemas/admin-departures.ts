import { z } from 'zod';
import { DecimalStringSchema } from './catalog.js';
import { AdminPageQuerySchema, CalendarDateSchema } from './common.js';

/**
 * Bề mặt GHI đầu tiên của catalog (spec P4e-1 F12) — bảng chuyến khởi hành của
 * MỘT tour, bốn thao tác: `list` · `create` · `update` · `setStatus`.
 *
 * ## Vì sao file riêng, không nằm trong `catalog.ts`
 *
 * `catalog.ts` là bề mặt ĐỌC CÔNG KHAI (web dựng trang tour từ nó). Hình dạng
 * ở đây chở những thứ chỉ back office được thấy — `seatsBooked`,
 * `liveBookingCount`, `priceOverride` thô — và một con số lọt sang phía khách
 * là rò rỉ vận hành. Hai bề mặt, hai file; cùng nếp `admin-*` của bookings và
 * enquiries.
 *
 * ## Hạn chót KHÔNG tự tính
 *
 * `cancellationDeadline` trên mỗi hàng do server tính bằng chính hàm của
 * `refund-policy.ts` (ADR-0041 §8: một nguồn duy nhất cho cả văn bản lẫn phép
 * tính). Màn hình IN con số ấy, không dựng lại luật N.
 */

/**
 * Trần ghế của một chuyến. DB chỉ có `seats_total >= 0` (`departures_seats_nonneg`)
 * nên schema là chỗ DUY NHẤT quan sát được trần này.
 *
 * Vì sao phải có trần: `maxGroupSize` mặc định của tour là 20, và một `z.int()`
 * không chặn trên nhận cả `2_000_000` — con số đó không nổ ở đâu cả, nó chỉ
 * âm thầm biến một chuyến thành "còn 1.999.988 chỗ" trên trang khách. 500 rộng
 * hơn mọi đoàn thật của nền tảng mà vẫn là một con số người đọc thấy sai ngay.
 */
export const DEPARTURE_SEATS_MAX = 500;

/**
 * Trần cho giá — gương của cột `Decimal(14, 2)`, tức 12 chữ số phần nguyên.
 *
 * Phải có, và đây là lý do: không trần thì một lần gõ nhầm 13 chữ số đi lọt cả
 * ba tầng rồi mới chết ở Postgres bằng `22003 numeric field overflow`.
 * `mapError` không nhận ra lỗi Prisma nên nó thành 500 trần, phía admin phân
 * loại ra `GENERIC`, mà `GENERIC` nằm trong nhóm "kết cục KHÔNG RÕ" — kit sẽ
 * ĐÓNG dialog, toast rồi refresh. Người dùng mất sạch bốn ô vừa điền kèm một
 * câu nói lệnh có thể đã đi qua. Chặn ở schema thì lỗi hiện ngay dưới ô giá.
 */
export const DEPARTURE_PRICE_MAX = 999_999_999_999.99;

/**
 * Giá một chuyến: chuỗi thập phân TỐI ĐA 2 chữ số lẻ và không vượt trần cột.
 *
 * Hai chữ số lẻ là ràng buộc thật chứ không phải khó tính: `DecimalStringSchema`
 * cho phép số lẻ tuỳ ý, nên `'129.999'` đi qua rồi bị cột làm tròn thành
 * `130.00` — một con số khách sẽ trả mà không ai gõ vào.
 */
export const DeparturePriceSchema = DecimalStringSchema.refine(
  (value) => {
    const [, phanLe] = value.split('.');
    return (phanLe?.length ?? 0) <= 2;
  },
  { message: 'price must have at most 2 decimal places' },
).refine((value) => Number(value) <= DEPARTURE_PRICE_MAX, {
  message: 'price is above the maximum this catalogue supports',
});

/** Mirrors Prisma enum `DepartureStatus` — ĐỌC thấy cả ba giá trị. */
export const AdminDepartureStatusSchema = z.enum(['OPEN', 'CLOSED', 'CANCELLED']);
export type AdminDepartureStatus = z.output<typeof AdminDepartureStatusSchema>;

/**
 * Trạng thái admin ĐẶT được bằng tay — chỉ hai (spec F12).
 *
 * `CANCELLED` cố ý VẮNG MẶT: huỷ chuyến kéo theo hoàn tiền cho mọi khách đã
 * trả (ADR-0041 §6) và đi qua đường riêng của F13. Để nó lọt vào đây là mở một
 * cửa hậu đổi trạng thái sang CANCELLED mà không hoàn một đồng nào — và không
 * ai nhìn thấy, vì bảng chuyến hiện đúng thứ admin vừa bấm.
 */
export const AdminDepartureSettableStatusSchema = z.enum(['OPEN', 'CLOSED']);
export type AdminDepartureSettableStatus = z.output<typeof AdminDepartureSettableStatusSchema>;

/** Một hàng của bảng `/tours/[slug]/departures`. */
export const AdminDepartureRowSchema = z.object({
  id: z.uuid(),
  startDate: z.iso.date(),
  endDate: z.iso.date(),
  /** Giá ÁP DỤNG = `priceOverride ?? tour.basePrice` — con số khách thật sự trả. */
  price: DecimalStringSchema,
  /**
   * Giá riêng của chuyến, `null` = thừa hưởng `basePrice`. Đi kèm `price` chứ
   * không thay nó: bảng in `price`, còn form sửa cần biết ô giá đang TRỐNG hay
   * đang mang một con số riêng — `price` một mình đã gộp hai ca đó thành một,
   * và mở form ra thấy `129.00` thì bấm Save là vô tình đóng đinh giá tour vào
   * chuyến.
   */
  priceOverride: DecimalStringSchema.nullable(),
  currency: z.string().length(3),
  seatsBooked: z.int().nonnegative(),
  /**
   * Cố ý RỘNG hơn ràng buộc của `Create`/`Update` (1..500): đây là hàng ĐỌC RA,
   * và DB chỉ bảo đảm `seats_total >= 0` (CHECK `departures_seats_nonneg`),
   * không có trần. Khai chặt ở đầu ra nghĩa là một hàng hợp lệ với DB nhưng
   * ngoài dải — do một lệnh UPDATE vá tay, một lần import, hay một tour có
   * `maxGroupSize > 500` — sẽ làm TRƯỢT validation đầu ra và 500 cả trang
   * `/tours/<slug>/departures`, kể cả chính cái form dùng để sửa hàng đó.
   */
  seatsTotal: z.int().nonnegative(),
  status: AdminDepartureStatusSchema,
  /** `cancellationDeadline(startDate, endDate)` — ngày chót huỷ miễn phí VÀ chót nhận đặt. */
  cancellationDeadline: z.iso.date(),
  /**
   * Số booking còn SỐNG (`PENDING`, `PAID`, `PARTIALLY_REFUNDED`) — nuôi luật
   * chặn đổi ngày (§2b) và, từ F13, cột tiến độ hoàn tiền.
   *
   * Khác `seatsBooked`: một booking chở nhiều ghế, và `seatsBooked` là con số
   * GHẾ mà CHECK canh. Đừng dùng thay nhau.
   */
  liveBookingCount: z.int().nonnegative(),
  /**
   * Trong số `liveBookingCount`, bao nhiêu là booking CHƯA trả tiền (`PENDING`,
   * phiên thanh toán còn sống).
   *
   * Tách ra vì hai con số dẫn tới hai hệ quả khác hẳn nhau khi admin đóng
   * chuyến: khách ĐÃ trả thì giữ chỗ và không ai báo gì, còn khách ĐANG trả sẽ
   * bị đường claim từ chối (`departure-closed`) rồi hoàn tiền tự động kèm email.
   * Gộp chung một số thì hộp xác nhận không thể nói đúng sự thật.
   */
  pendingBookingCount: z.int().nonnegative(),
  /**
   * Phiên bản hàng, gửi lại nguyên xi khi sửa — chống ghi đè mù giữa hai tab.
   * Giá trị là `updatedAt` dạng ISO; xem `AdminDepartureUpdateInputSchema.version`
   * về việc vì sao `FOR UPDATE` một mình không đủ.
   */
  version: z.iso.datetime(),
});
export type AdminDepartureRow = z.output<typeof AdminDepartureRowSchema>;

/** Tour mà bảng đang đứng trong — đủ cho breadcrumb, tiêu đề và giá mặc định của form tạo. */
export const AdminDepartureTourSchema = z.object({
  id: z.uuid(),
  slug: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  basePrice: DecimalStringSchema,
  currency: z.string().length(3),
});
export type AdminDepartureTour = z.output<typeof AdminDepartureTourSchema>;

export const AdminDeparturesListQuerySchema = AdminPageQuerySchema.extend({
  /** Bảng luôn thuộc về đúng MỘT tour — `slug` vì URL của màn là `/tours/[slug]/departures`. */
  slug: z.string().min(1).max(120),
  status: AdminDepartureStatusSchema.optional(),
});
export type AdminDeparturesListQuery = z.output<typeof AdminDeparturesListQuerySchema>;

/**
 * Trang chuyến CỘNG tour đang mở.
 *
 * Gộp tour vào kết quả thay vì để màn gọi thêm một endpoint: tiêu đề,
 * breadcrumb và giá mặc định của dialog tạo đều là của CÙNG một lần đọc, nên
 * hai lượt gọi chỉ tạo thêm một cửa sổ để chúng nói khác nhau. Cùng nếp
 * `AdminSubscribersListResultSchema`.
 */
export const AdminDeparturesListResultSchema = z.object({
  items: z.array(AdminDepartureRowSchema),
  page: z.int().min(1),
  limit: z.int().min(1),
  total: z.int().nonnegative(),
  totalPages: z.int().nonnegative(),
  tour: AdminDepartureTourSchema,
});
export type AdminDeparturesListResult = z.output<typeof AdminDeparturesListResultSchema>;

/**
 * Tạo một chuyến. `endDate >= startDate` và "không tạo chuyến đã khởi hành"
 * KHÔNG canh ở đây — cả hai là phán quyết của SERVER (mã lỗi riêng để màn in
 * đúng câu), và cái thứ hai còn phụ thuộc ngày Việt Nam hôm nay, thứ mà đồng
 * hồ trình duyệt không được phép quyết.
 */
export const AdminDepartureCreateInputSchema = z.object({
  slug: z.string().min(1).max(120),
  startDate: CalendarDateSchema,
  endDate: CalendarDateSchema,
  seatsTotal: z.int().min(1).max(DEPARTURE_SEATS_MAX),
  /** Bỏ trống = thừa hưởng `basePrice` của tour (spec F12). */
  priceOverride: DeparturePriceSchema.nullable().default(null),
});
export type AdminDepartureCreateInput = z.output<typeof AdminDepartureCreateInputSchema>;

/**
 * Sửa một chuyến — thay TRỌN bốn field sửa được, không patch từng phần.
 *
 * Dialog luôn mở sẵn giá trị hiện tại nên gửi đủ là tự nhiên, và nó gỡ một
 * chỗ mập mờ thật: với patch thì `priceOverride: undefined` ("đừng đụng tới")
 * và `priceOverride: null` ("xoá giá riêng đi") chỉ cách nhau một field bị
 * rơi trên đường truyền.
 *
 * `status` KHÔNG sửa ở đây — đóng/mở là `setStatus`, huỷ là F13.
 */
export const AdminDepartureUpdateInputSchema = z.object({
  id: z.uuid(),
  startDate: CalendarDateSchema,
  endDate: CalendarDateSchema,
  seatsTotal: z.int().min(1).max(DEPARTURE_SEATS_MAX),
  priceOverride: DeparturePriceSchema.nullable(),
  /**
   * Phiên bản hàng mà form ĐANG hiển thị — chống ghi đè mù giữa hai tab.
   *
   * `FOR UPDATE` tuần tự hoá hai lệnh ghi nhưng KHÔNG phát hiện được cái cũ, vì
   * giá trị "hiện tại" trong payload đến từ form trình duyệt chứ không từ hàng
   * vừa khoá. Không có token này thì: A đổi 20 ghế thành 45 lúc 10:01, B bấm
   * Lưu từ form mở lúc 10:00 và ghi đè về 20 — 25 ghế biến mất im lặng, không
   * lỗi, không toast. Rồi khách đặt tiếp đâm vào trần 20, claim trả
   * `overbooked`, và hệ thống tự hoàn tiền người ĐÃ trả.
   *
   * Dùng `updatedAt` làm token: Prisma tự cập nhật nó mỗi lần ghi, nên không
   * cần thêm cột. Server so token với hàng đã khoá; lệch là `DEPARTURE_STALE`.
   */
  version: z.iso.datetime(),
});
export type AdminDepartureUpdateInput = z.output<typeof AdminDepartureUpdateInputSchema>;

/** Đóng hoặc mở lại — xem `AdminDepartureSettableStatusSchema` về việc `CANCELLED` vắng mặt. */
export const AdminDepartureSetStatusInputSchema = z.object({
  id: z.uuid(),
  status: AdminDepartureSettableStatusSchema,
});
export type AdminDepartureSetStatusInput = z.output<typeof AdminDepartureSetStatusInputSchema>;

/**
 * Trần cho lý do huỷ chuyến — gương của cột `cancellation_requests.reason`.
 *
 * Có trần vì cùng lý do với trần giá: không trần thì một lần dán nhầm cả trang
 * văn bản đi lọt cả ba tầng rồi chết ở Postgres, và `mapError` không nhận ra
 * lỗi Prisma nên nó thành 500 trần — kit đóng dialog, admin mất cả ô lý do vừa
 * gõ mà không biết vì sao.
 */
export const DEPARTURE_CANCEL_REASON_MAX = 500;

/**
 * Công ty huỷ chuyến (F13, ADR-0041 §6).
 *
 * `reason` BẮT BUỘC và không được rỗng: đây là lệnh ghi duy nhất của vùng này
 * tiêu tiền thật, và câu "vì sao" là thứ duy nhất còn lại khi ai đó mở sổ ra
 * đọc sáu tháng sau. Ba lệnh kia (`create`/`update`/`setStatus`) không đòi lý
 * do vì chúng đảo ngược được bằng đúng một thao tác ngược lại.
 */
export const AdminDepartureCancelInputSchema = z.object({
  id: z.uuid(),
  reason: z.string().trim().min(1).max(DEPARTURE_CANCEL_REASON_MAX),
});
export type AdminDepartureCancelInput = z.output<typeof AdminDepartureCancelInputSchema>;
