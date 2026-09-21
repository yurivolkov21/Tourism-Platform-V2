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
  seatsTotal: z.int().min(1).max(DEPARTURE_SEATS_MAX),
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
  priceOverride: DecimalStringSchema.nullable().default(null),
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
  priceOverride: DecimalStringSchema.nullable(),
});
export type AdminDepartureUpdateInput = z.output<typeof AdminDepartureUpdateInputSchema>;

/** Đóng hoặc mở lại — xem `AdminDepartureSettableStatusSchema` về việc `CANCELLED` vắng mặt. */
export const AdminDepartureSetStatusInputSchema = z.object({
  id: z.uuid(),
  status: AdminDepartureSettableStatusSchema,
});
export type AdminDepartureSetStatusInput = z.output<typeof AdminDepartureSetStatusInputSchema>;
