import { z } from 'zod';
import { DecimalStringSchema } from './catalog.js';

/**
 * Số liệu vùng admin (spec P4b §3-F5) — nguồn cho hàng stat card đứng TRÊN
 * bảng của `/bookings`, `/cancellations`, `/reviews`. P4d nối dashboard vào
 * đúng bộ schema này, không khai bộ thứ hai.
 *
 * Hai luật xuyên suốt, cả hai đều là quyết định có chủ đích:
 *
 * 1. **Server trả CẢ HAI số** (kỳ này + kỳ liền trước) cho mỗi metric. Client
 *    chỉ so sánh để chọn mũi tên/màu và in con số kỳ trước vào caption — nó
 *    KHÔNG tự chế phép delta bằng một cửa sổ thời gian tự tính. Một cửa sổ
 *    tính ở hai nơi là hai cửa sổ sẽ trôi lệch.
 * 2. **Tiền là chuỗi thập phân, đếm là int** — cùng quy ước serialize với
 *    `bookings.ts`/`catalog.ts`: money KHÔNG BAO GIỜ thành float.
 */

/**
 * Cửa sổ so sánh mặc định của mọi stat card: 28 ngày gần nhất so với 28 ngày
 * liền trước (spec P4b §3-F5 — mẫu user chốt 31/08). 28 chứ không phải 30:
 * bốn tuần chẵn nên hai kỳ có cùng số ngày cuối tuần, thứ mà lưu lượng booking
 * bám rất sát.
 */
export const STATS_WINDOW_DAYS = 28;

/**
 * Ngưỡng "kẹt" của payment event chưa xử lý (vòng vá review F8): row
 * `processedAt` null là chuyện BÌNH THƯỜNG trong vài giây sau khi nhận
 * (handler đang chạy), chỉ khi nó còn đó sau ngần này phút — provider đã
 * retry ít nhất một lượt mà vẫn không xong — mới là thứ cần người soi.
 * Stripe/PayPal retry lượt đầu trong ~vài phút; 5 phút là mốc đủ chắc để
 * card không kêu đỏ với mọi webhook vừa tới.
 */
export const PAYMENT_EVENT_STUCK_MINUTES = 5;

/**
 * Cặp số của MỘT metric. Factory chứ không chép ba lần: mọi metric có ĐÚNG
 * hình dạng này, và `previous` là BẮT BUỘC — thiếu nó thì client không còn
 * cách nào ngoài tự chế delta, đúng thứ luật #1 cấm.
 */
function metricPair<T extends z.ZodType>(value: T) {
  return z.object({ current: value, previous: value });
}

/** Metric đếm: số nguyên không âm (booking, request, review). */
export const CountMetricSchema = metricPair(z.int().nonnegative());
export type CountMetric = z.output<typeof CountMetricSchema>;

/** Metric tiền: chuỗi thập phân của contract ('1240.50'), không bao giờ float. */
export const MoneyMetricSchema = metricPair(DecimalStringSchema);
export type MoneyMetric = z.output<typeof MoneyMetricSchema>;

/**
 * Metric thập phân CÓ THỂ KHÔNG TÍNH ĐƯỢC trong một kỳ: tỉ lệ huỷ khi kỳ đó
 * không có booking nào đã trả tiền (không có mẫu số), điểm trung bình khi kỳ
 * đó không có review nào. `null` là câu trả lời THẬT — trả '0' sẽ nói dối
 * ("0% huỷ", "0 sao") và pill delta sẽ vẽ một cú lao dốc không có thật.
 */
export const DecimalMetricSchema = metricPair(DecimalStringSchema.nullable());
export type DecimalMetric = z.output<typeof DecimalMetricSchema>;

/**
 * Cửa sổ mà bộ số được tính trên đó — đi kèm MỌI response stats.
 *
 * Vì sao phơi ra thay vì để client tự biết "28 ngày": (a) caption "vs X prior
 * N days" lấy N từ đây nên hằng số chỉ có MỘT bản, (b) đây là số admin đem so
 * sổ — có `currentFrom`/`previousFrom`/`generatedAt` thì dựng lại đúng câu
 * query đã sinh ra con số là chuyện làm được, không phải đoán.
 *
 * Mọi mốc là ISO UTC. Hai kỳ dài BẰNG NHAU và khít nhau:
 * `[previousFrom, currentFrom)` là kỳ trước, `[currentFrom, generatedAt)` là
 * kỳ này.
 */
export const StatsPeriodSchema = z.object({
  windowDays: z.int().positive(),
  currentFrom: z.iso.datetime(),
  previousFrom: z.iso.datetime(),
  generatedAt: z.iso.datetime(),
});
export type StatsPeriod = z.output<typeof StatsPeriodSchema>;

/**
 * Bộ số vùng `/bookings`. Định nghĩa TỪNG metric nằm ở JSDoc của
 * `StatsService` phía API (một nguồn, cạnh câu query thật) — ở đây chỉ ghi
 * điều client cần biết để render.
 */
export const AdminBookingsStatsSchema = z.object({
  period: StatsPeriodSchema,
  /**
   * Đồng tiền của `revenue` (ISO-4217). Có mặt để client KHÔNG phải đoán một
   * đồng tiền rồi in nhầm ký hiệu lên một con số tiền. Nền tảng hiện là
   * một-đồng-tiền (cột `currency` của Booking/Tour đều default USD, không có
   * FX ở đâu) nên `SUM` mới có nghĩa — ngày nào có nhiều đồng tiền thật thì
   * chính SUM đó phải đổi thành group-by, không phải field này.
   */
  currency: z.string().length(3),
  /** Tổng tiền booking đã thu trong kỳ (gross — chưa trừ hoàn). */
  revenue: MoneyMetricSchema,
  /** Số booking đã thu tiền trong kỳ — cùng tập với `revenue`. */
  paidBookings: CountMetricSchema,
  /** Số booking được TẠO trong kỳ, mọi trạng thái. */
  newBookings: CountMetricSchema,
  /** PHẦN TRĂM 0..100 ('8.3'), không phải tỉ lệ 0..1. null = kỳ không có mẫu số. */
  cancellationRate: DecimalMetricSchema,
});
export type AdminBookingsStats = z.output<typeof AdminBookingsStatsSchema>;

/** Bộ số vùng `/cancellations`. */
export const AdminCancellationsStatsSchema = z.object({
  period: StatsPeriodSchema,
  /** Ảnh chụp hàng đợi đang mở: BÂY GIỜ so với ĐẦU kỳ này (không phải đếm trong kỳ). */
  pendingQueue: CountMetricSchema,
  /** Request được duyệt (hoàn tiền) trong kỳ. */
  approved: CountMetricSchema,
  /** Request bị từ chối trong kỳ. */
  denied: CountMetricSchema,
});
export type AdminCancellationsStats = z.output<typeof AdminCancellationsStatsSchema>;

/** Bộ số vùng `/reviews`. */
export const AdminReviewsStatsSchema = z.object({
  period: StatsPeriodSchema,
  /** Ảnh chụp hàng đợi chờ duyệt: BÂY GIỜ so với ĐẦU kỳ này. */
  pending: CountMetricSchema,
  /** Review được duyệt trong kỳ. */
  approved: CountMetricSchema,
  /** Điểm trung bình 1..5 ('4.60'). null = kỳ không có review nào. */
  averageRating: DecimalMetricSchema,
});
export type AdminReviewsStats = z.output<typeof AdminReviewsStatsSchema>;

/**
 * Bộ số vùng `/outbox` (spec P4c §3-F7). Chỉ `sent` là số ĐẾM TRONG kỳ (theo
 * `processedAt`) nên mới có cặp hai kỳ; `queued`/`failed` là ẢNH CHỤP hàng
 * đợi ngay bây giờ — một số đơn, card không có delta (cùng luật F5: không có
 * mốc thời gian để dựng lại "lúc đầu kỳ" thì không bịa một kỳ trước).
 */
export const AdminOutboxStatsSchema = z.object({
  period: StatsPeriodSchema,
  /**
   * Email đã giao trong KỲ NÀY (`processedAt`, status SENT — KHÔNG đếm
   * SKIPPED). Một số đơn, KHÔNG có kỳ trước (vòng vá review F7): purge cron
   * xoá row SENT cũ hơn 30 ngày nên kỳ 28–56 ngày trước gần như trống — một
   * cặp ở đây là một pill "↑1200%" bịa mỗi ngày.
   */
  sent: z.int().nonnegative(),
  /** Row PENDING ngay bây giờ — đúng bằng số hàng `/outbox?status=PENDING`. */
  queued: z.int().nonnegative(),
  /** Row FAILED ngay bây giờ — đúng bằng số hàng `/outbox?status=FAILED`. */
  failed: z.int().nonnegative(),
});
export type AdminOutboxStats = z.output<typeof AdminOutboxStatsSchema>;

/**
 * Bộ số vùng `/payment-events` (spec P4c §3-F8). Hai metric neo `receivedAt`
 * nên có CẶP hai kỳ; `unprocessed` là ẢNH CHỤP — row `processedAt` null ngay
 * bây giờ — không có mốc "lúc đầu kỳ" để dựng lại (processedAt chỉ ghi khi
 * xong, không ghi lúc bắt đầu chờ), contract khai số đơn (cùng luật F5/F7).
 */
export const AdminPaymentEventsStatsSchema = z.object({
  period: StatsPeriodSchema,
  /** Webhook đã NHẬN (verify chữ ký xong) trong kỳ — mọi provider, mọi type. */
  received: CountMetricSchema,
  /** Row `processedAt` null ngay bây giờ — đúng bằng `/payment-events?unprocessed=true`. */
  unprocessed: z.int().nonnegative(),
  /**
   * Trong `unprocessed`, bao nhiêu row đã nhận từ hơn `PAYMENT_EVENT_STUCK_MINUTES`
   * phút trước — "kẹt", không phải "đang chạy". Card chỉ kêu đỏ khi số này
   * > 0 (vòng vá review F8); `unprocessed` vẫn là con số bảng khớp.
   */
  stuck: z.int().nonnegative(),
  /** Trong số nhận trong kỳ, bao nhiêu gắn được `bookingId` (event `other` thường không). */
  linked: CountMetricSchema,
});
export type AdminPaymentEventsStats = z.output<typeof AdminPaymentEventsStatsSchema>;

/**
 * Bộ số vùng `/enquiries` (spec P4c §3-F9). Hai metric neo vào một MỐC THỜI
 * GIAN nên có cặp hai kỳ; `open` là ẢNH CHỤP hàng chờ ngay bây giờ — số đơn,
 * card không có delta (cùng luật F5/F7/F8).
 */
export const AdminEnquiriesStatsSchema = z.object({
  period: StatsPeriodSchema,
  /**
   * Lead GỬI trong kỳ (`createdAt`) — mọi trạng thái.
   *
   * Tên là `created` chứ KHÔNG phải `new`: card đọc là "New 28d" nhưng con số
   * này KHÔNG lọc `status = NEW` (một lead gửi hôm kia mà hôm nay đã WON vẫn
   * là lead mới của kỳ). Đặt tên theo trạng thái ở đây là mời người đọc sau
   * "sửa" nó thành một câu query khác hẳn.
   */
  created: CountMetricSchema,
  /**
   * Số LƯỢT chuyển sang WON trong kỳ — đếm trên audit trail
   * `enquiry_status_events` (`to_status = WON`, `created_at` của EVENT), chứ
   * KHÔNG trên `enquiries.updated_at` (spec §2.5, bài học F5): một lead WON
   * hôm nay bị sửa sang LOST tuần sau sẽ tự xoá mình khỏi con số của một kỳ
   * đã đóng nếu đếm theo trạng thái hiện tại.
   */
  won: CountMetricSchema,
  /**
   * Lead đang MỞ ngay bây giờ (`OPEN_ENQUIRY_STATUSES` — NEW + CONTACTED +
   * QUOTED). Ảnh chụp: trạng thái không để lại mốc thời gian khi rời đi nên
   * không dựng lại được "lúc đầu kỳ" — số đơn thay vì bịa một cặp.
   *
   * KHÔNG có callout đỏ: hàng chờ CRM là trạng thái bình thường của một
   * đường bán hàng đang sống, khác `outbox.failed` (chỉ rời FAILED khi có
   * người can thiệp).
   */
  open: z.int().nonnegative(),
});
export type AdminEnquiriesStats = z.output<typeof AdminEnquiriesStatsSchema>;
