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
