import { z } from 'zod';
import { BookingStatusSchema } from './bookings.js';
import { DecimalStringSchema, SignedDecimalStringSchema } from './catalog.js';

/**
 * Báo cáo THÁNG của admin (spec P4b §3-F6) — nguồn cho trang `/reports`, nút
 * CSV của nó và bản in ra PDF bằng chính trình duyệt.
 *
 * ## Vì sao một endpoint RIÊNG chứ không chỉ dùng `admin.stats.*`
 *
 * ⚠️ Từ ADR-0028, `admin.stats.bookings` CÓ nhận `{from,to}` — nên vế "stats
 * không nhận khoảng ngày" của đoạn dưới đã hết đúng. Vế thật sự biện minh cho
 * hai endpoint thì còn nguyên, và chính ADR-0028 giữ nó bằng cửa sổ kỳ-trước
 * dài BẰNG NHAU lùi liền kề (không phải tháng lịch trước).
 *
 * Hai bề mặt trả lời hai câu hỏi khác nhau, và hình dạng response nói rõ điều
 * đó:
 *
 * - `admin.stats.*` là "kỳ này SO VỚI kỳ trước": mỗi metric là một CẶP số, và
 *   pill delta chỉ nói thật khi hai kỳ DÀI BẰNG NHAU (xem `stats.ts` +
 *   `stats-math.ts`). Tháng LỊCH thì không: so tháng 2 (28 ngày) với tháng 1
 *   (31 ngày) là bịa ra một cú sụt 10% từ hư không. Đây là lý do khoảng ngày
 *   của ADR-0028 so với một cửa sổ dài bằng nó lùi liền kề, KHÔNG so với
 *   tháng lịch liền trước — bất biến giữ nguyên, chỉ độ dài cửa sổ là đổi.
 * - Báo cáo tháng là TỔNG TUYỆT ĐỐI của một kỳ đóng, cộng những con số mà stat
 *   card không có (phân rã theo trạng thái, tổng hoàn tiền) và không cần
 *   những con số mà stat card có (ảnh chụp hàng đợi "bây giờ" — vô nghĩa
 *   trong một báo cáo về tháng 7).
 *
 * Cái được dùng chung là thứ ĐÁNG dùng chung: chính các câu aggregate
 * (`stats-aggregates.ts` bên API). Định nghĩa doanh thu vẫn CHỈ CÓ MỘT —
 * neo theo `paid_at`, gross — và JSDoc của `StatsService` vẫn là nơi duy nhất
 * kể định nghĩa từng metric.
 */

/**
 * Tháng lịch `YYYY-MM` — đơn vị URL-state của `/reports` và của báo cáo.
 *
 * Năm bị KHOÁ vào 1900–2099 (vòng vá review F6) vì `?month=` là thứ người gõ
 * được và `Date.UTC` có hai hành vi legacy ở biên: năm 0–99 bị ánh xạ thành
 * 1900+năm (`0050-06` âm thầm thành tháng 6/1950 — nhãn nói một đằng, số liệu
 * một nẻo), còn `9999-12` sinh mốc cuối kỳ ở năm 10000 mà `toISOString()` in
 * thành `+010000-…`, thứ `z.iso.datetime()` của chính response từ chối — một
 * URL gõ tay nổ thành trang lỗi. Cùng trần với `CalendarDateSchema` bên
 * `bookings.ts` — hai bộ lọc ngày của admin chung MỘT luật năm.
 */
export const ReportMonthSchema = z
  .string()
  .regex(/^(19|20)\d{2}-(0[1-9]|1[0-2])$/, 'month must be YYYY-MM between 1900 and 2099');

export type ReportMonth = z.output<typeof ReportMonthSchema>;

/**
 * Input `admin.reports.monthly`. `month` BẮT BUỘC: "tháng hiện tại" là khái
 * niệm của người đang xem (URL-state `?month=`), không phải của đồng hồ
 * server — một mặc định ngầm ở đây sẽ khiến cùng một đường dẫn trả hai câu
 * trả lời khác nhau tuỳ lúc gọi.
 */
export const AdminMonthlyReportQuerySchema = z.object({ month: ReportMonthSchema });

export type AdminMonthlyReportQuery = z.output<typeof AdminMonthlyReportQuerySchema>;

/** Một hàng của bảng phân rã trạng thái. */
export const BookingStatusCountSchema = z.object({
  status: BookingStatusSchema,
  count: z.int().nonnegative(),
});

export type BookingStatusCount = z.output<typeof BookingStatusCountSchema>;

export const AdminMonthlyReportSchema = z.object({
  /** Chính tháng đã hỏi, dội lại — để bản in/CSV không phải tin vào URL. */
  month: ReportMonthSchema,
  /** Đầu kỳ, ISO UTC — TÍNH VÀO (`>=`). */
  from: z.iso.datetime(),
  /** Cuối kỳ, ISO UTC — KHÔNG tính vào (`<`), tức 00:00 ngày 1 tháng sau. */
  to: z.iso.datetime(),
  /** Lúc chốt sổ — bản in giấy phải nói nó được sinh ra khi nào. */
  generatedAt: z.iso.datetime(),
  /** Đồng tiền của `revenue`/`refundedTotal` (xem cảnh báo group-by ở `stats.ts`). */
  currency: z.string().length(3),
  /** Tiền THU trong tháng (theo `paid_at`), GROSS — hoàn tiền không trừ ở đây. */
  revenue: DecimalStringSchema,
  /** Số booking đã thu tiền trong tháng — cùng tập với `revenue`. */
  paidBookings: z.int().nonnegative(),
  /** Số booking được TẠO trong tháng, mọi trạng thái. */
  newBookings: z.int().nonnegative(),
  /**
   * Phân rã lứa booking TẠO trong tháng theo trạng thái HIỆN TẠI của chúng.
   * Tổng các `count` luôn bằng `newBookings` — hai con số kiểm chéo nhau.
   *
   * Phủ ĐỦ mọi trạng thái kể cả 0 (`.length` theo chính enum): bảng báo cáo
   * và CSV có số hàng cố định giữa các tháng, nên "0" hiện ra như một con số
   * chứ không biến mất thành một dòng thiếu.
   */
  bookingsByStatus: z.array(BookingStatusCountSchema).length(BookingStatusSchema.options.length),
  /**
   * Tiền HOÀN trong tháng — tổng sổ cái `refunds` theo `created_at` (ADR-0009).
   * KHÔNG trừ vào `revenue`, và một dòng hoàn tháng này có thể thuộc booking
   * đã trả tiền từ tháng trước: đây là dòng tiền ĐI RA của tháng, không phải
   * một phép hiệu chỉnh doanh thu.
   */
  refundedTotal: DecimalStringSchema,
  /** Số LƯỢT hoàn trong tháng (một booking có thể hoàn nhiều lần). */
  refunds: z.int().nonnegative(),
  /** Request huỷ được duyệt trong tháng (theo `decided_at`). */
  cancellationsApproved: z.int().nonnegative(),
  /** Request huỷ bị từ chối trong tháng (theo `decided_at`). */
  cancellationsDenied: z.int().nonnegative(),
  /** Lượt duyệt review trong tháng — đếm trên audit trail, xem `StatsService`. */
  reviewsApproved: z.int().nonnegative(),

  // ── Kết quả kinh doanh (ADR-0033 §1) ──────────────────────────────────
  // Mọi field dưới đây neo NGÀY CHUYẾN KẾT THÚC, khác hẳn mọi field ở trên
  // (neo `paid_at`). Hai cách đọc đứng CẠNH nhau, không thay nhau — đọc §1
  // của ADR trước khi sửa bất cứ field nào.
  /** Σ (`totalAmount` − đã hoàn) của booking đã đi, chuyến KẾT THÚC trong kỳ. */
  recognizedRevenue: DecimalStringSchema,
  /** Giá vốn theo đầu khách của chính tập booking ấy — đi theo khách. */
  cogsVariable: DecimalStringSchema,
  /** Giá vốn theo chuyến — MỘT lần mỗi chuyến đã chạy, xe vẫn chạy khi khách huỷ. */
  cogsFixed: DecimalStringSchema,
  /** `cogsVariable + cogsFixed`. In cả ba để hai vế kiểm chéo được trên giấy. */
  cogsTotal: DecimalStringSchema,
  /** `recognizedRevenue − cogsTotal`. **ÂM được** — tháng lỗ là một tháng thật. */
  grossProfit: SignedDecimalStringSchema,
  /**
   * `grossProfit ÷ recognizedRevenue`, dạng TỈ LỆ (0.4 = 40%).
   *
   * **`null` khi `recognizedRevenue` = 0**, không phải 0. Một tháng không có
   * chuyến nào chạy có biên gộp KHÔNG XÁC ĐỊNH; in `0.0%` là nói tháng ấy hoà
   * vốn trắng — một câu khác hẳn, và sai.
   */
  grossMarginPct: z.number().nullable(),
  /**
   * Thuế suất đã dùng để ra `taxAmount`, dạng tỉ lệ.
   *
   * Đi kèm response vì biến môi trường KHÔNG có ngày hiệu lực (ADR-0033 §5):
   * đổi suất là đổi luôn số thuế của mọi báo cáo cũ khi đọc lại. Tờ báo cáo
   * phải tự khai nó được tính bằng mức nào, kẻo hai lần đọc cùng một tháng ra
   * hai con số mà không ai biết vì sao.
   */
  taxRate: z.number().nonnegative(),
  /** Thuế trên MARGIN: `max(0, grossProfit) × rate/(1+rate)` — margin âm thì 0. */
  taxAmount: DecimalStringSchema,
  /** Phí cổng thanh toán ước tính trên chính tập booking được ghi nhận. */
  paymentFees: DecimalStringSchema,
  /**
   * `grossProfit − taxAmount − paymentFees`. **ÂM được.**
   *
   * CHƯA trừ chi phí vận hành (lương, văn phòng, marketing) — hệ chưa có chỗ
   * nào khai chúng. Nhãn trên màn hình và trong file phải nói đúng chừng ấy,
   * không hơn (ADR-0033 §Giới hạn #4).
   */
  netProfit: SignedDecimalStringSchema,
  /** Số chuyến ĐÃ CHẠY trong kỳ — mẫu số của `cogsFixed`, để kiểm chéo. */
  departuresRun: z.int().nonnegative(),
  /**
   * Số booking trong kỳ KHÔNG có `cost_per_person`.
   *
   * Hiện trên màn hình và trong file: một báo cáo in "Lợi nhuận gộp $8,400"
   * trong khi 12 booking chưa khai giá vốn là một báo cáo NÓI DỐI; in kèm con
   * số này thì nó chỉ là chưa đầy đủ (ADR-0033 §6).
   */
  costDataMissing: z.int().nonnegative(),
  /**
   * Số chuyến ĐÃ CHẠY trong kỳ mà chưa khai `fixed_cost_amount` — vế còn lại
   * của "báo cáo phải nói ra là thiếu" (ADR-0033 §3, AMEND 1c). `cogsFixed`
   * coi chúng bằng 0, nên số này > 0 là `netProfit` đang phình đúng bằng tiền
   * xe của chừng ấy chuyến.
   */
  departuresCostMissing: z.int().nonnegative(),
});

export type AdminMonthlyReport = z.output<typeof AdminMonthlyReportSchema>;
