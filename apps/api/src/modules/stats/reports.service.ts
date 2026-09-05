import { Injectable } from '@nestjs/common';
import { type AdminMonthlyReport, BookingStatusSchema } from '@tourism/contract';
import { env } from '../../config/env.js';
import type { BookingStatus } from '../../generated/prisma/enums.js';
import { grossMarginPct, paymentFees, taxOnMargin } from './finance-math.js';
import {
  bookingsCreatedByStatus,
  decisionsSlice,
  fixedCostSlice,
  paidBookingsSlice,
  recognizedRevenueSlice,
  refundCurrency,
  refundsSlice,
  revenueCurrency,
  reviewApprovals,
} from './stats-aggregates.js';
import { grossAmount, monthWindow } from './stats-math.js';

/**
 * Báo cáo THÁNG của admin (spec P4b §3-F6) — nguồn của trang `/reports`, nút
 * CSV của nó và bản in PDF.
 *
 * ## Quan hệ với `StatsService`
 *
 * Hai bề mặt, MỘT bộ định nghĩa. Các câu aggregate là chung
 * (`stats-aggregates.ts`) nên "doanh thu" ở đây và trên stat card `/bookings`
 * là đúng một phép tính: `SUM(total_amount)` của booking có `paid_at` trong
 * kỳ, GROSS. Cái khác nhau chỉ là hình dạng câu trả lời — stat card so hai kỳ
 * dài bằng nhau, báo cáo cộng tổng một kỳ đóng (lý do đầy đủ ở JSDoc
 * `schemas/reports.ts`).
 *
 * Định nghĩa từng metric kể ở JSDoc `StatsService`; ba con số chỉ báo cáo mới
 * có được ghi ngay dưới đây.
 *
 * ## Ba con số riêng của báo cáo
 *
 * - `bookingsByStatus` — lứa booking TẠO trong tháng, phân rã theo trạng thái
 *   HIỆN TẠI của chúng. Là ẢNH CHỤP: một booking tạo tháng 5 rồi bị huỷ tháng
 *   7 sẽ đếm vào ô CANCELLED của báo cáo tháng 5 kể từ tháng 7 trở đi. Cố ý —
 *   câu hỏi mà bảng này trả lời là "lứa khách tháng 5 rốt cuộc ra sao", không
 *   phải "tháng 5 nhìn thấy gì". `newBookings` LÀ tổng của chính bảng phân rã
 *   này (một query, một khoảnh khắc) — bất biến theo cấu trúc.
 * - `refundedTotal` / `refunds` — sổ cái tiền ĐI RA theo `refunds.created_at`.
 *   KHÔNG trừ vào `revenue` và không cần cùng tháng với booking gốc.
 * - `generatedAt` — lúc chốt sổ. Là thứ DUY NHẤT trong response đổi giữa hai
 *   lần đọc cùng một tháng; mọi con số còn lại phải đứng yên.
 *
 * ## Cột thứ hai — kết quả kinh doanh (ADR-0033 §1)
 *
 * Từ 05/09 response mang THÊM một cột số liệu neo `departure_end_date` (những
 * chuyến KẾT THÚC trong kỳ), đứng CẠNH cột dòng tiền neo `paid_at` chứ không
 * thay nó. Lý do không đổi nghĩa cột cũ: `revenue` đang nuôi stat card ba
 * trang và chính bất biến "kỳ trước dài bằng kỳ này" của ADR-0028.
 *
 * Mọi phép TRỪ của báo cáo sống trong cột mới: giá vốn hai vế, thuế trên
 * margin, phí cổng. `refundedTotal` vẫn KHÔNG trừ vào `revenue`.
 *
 * ## Cửa sổ
 *
 * `[00:00 ngày 1, 00:00 ngày 1 tháng sau)` UTC, nửa-mở (`monthWindow`) — hai
 * tháng liền kề khít nhau, không row nào bị đếm hai lần. KHÔNG neo vào "bây
 * giờ": tháng 7 là tháng 7 dù đọc lúc nào.
 */
@Injectable()
export class ReportsService {
  async monthly(month: string): Promise<AdminMonthlyReport> {
    const { from, to } = monthWindow(month);
    const [
      paid,
      created,
      paidCurrency,
      refunds,
      refundsCurrency,
      decisions,
      reviewsApproved,
      recognised,
      fixedCost,
    ] = await Promise.all([
      paidBookingsSlice(from, to),
      bookingsCreatedByStatus(from, to),
      revenueCurrency(from, to),
      refundsSlice(from, to),
      refundCurrency(from, to),
      decisionsSlice(from, to),
      reviewApprovals(from, to),
      recognizedRevenueSlice(from, to),
      fixedCostSlice(from, to),
    ]);

    // ── Cột KẾT QUẢ KINH DOANH (ADR-0033 §1) ──────────────────────────────
    // Mọi phép TRỪ của báo cáo chỉ xảy ra ở đây. `revenue`/`refundedTotal`
    // bên dưới vẫn là dòng tiền gross và không đụng gì tới khối này.
    const cogsTotal = recognised.cogsVariable.add(fixedCost.total);
    const grossProfit = recognised.revenue.sub(cogsTotal);
    const taxAmount = taxOnMargin(grossProfit, env.MARGIN_TAX_RATE);
    const fees = paymentFees(
      // Phí trả trên tiền GỐC, trước khi trừ hoàn — provider không trả lại phí
      // khi hoàn (ADR-0033 §Giới hạn #3).
      recognised.grossCollected,
      recognised.bookings,
      env.PAYMENT_FEE_RATE,
      env.PAYMENT_FEE_FIXED,
    );

    // Điền 0 cho trạng thái vắng mặt: contract hứa ĐỦ mọi trạng thái, và thứ
    // tự theo enum để bảng/CSV có số hàng cố định giữa các tháng.
    const bookingsByStatus = BookingStatusSchema.options.map((status) => ({
      status,
      count: created.get(status as BookingStatus) ?? 0,
    }));

    return {
      month,
      from: from.toISOString(),
      to: to.toISOString(),
      generatedAt: new Date().toISOString(),
      // Nhãn tiền phục vụ CẢ `revenue` LẪN `refundedTotal` (contract), nên
      // hỏi lần lượt hai nguồn: payment của tháng trước, rồi sổ hoàn của
      // tháng (vòng vá review F6 — tháng chỉ có refund cho booking trả tiền
      // từ tháng trước từng bị dán nhãn 'USD' cho tiền EUR). Cả hai rỗng —
      // tức mọi con số tiền đều 0.00 — thì 'USD' mới là mặc định vô hại.
      currency: paidCurrency ?? refundsCurrency ?? 'USD',
      revenue: grossAmount(paid.revenue),
      paidBookings: paid.paid,
      // Tổng của CHÍNH phân rã ở trên, không phải một COUNT thứ hai (vòng vá
      // review F6): contract hứa hai con số bằng nhau và bản in đặt chúng
      // cạnh nhau để kiểm chéo, nên bất biến ấy phải đúng theo CẤU TRÚC chứ
      // không nhờ may mắn hai query chụp cùng một khoảnh khắc.
      newBookings: bookingsByStatus.reduce((sum, row) => sum + row.count, 0),
      bookingsByStatus,
      refundedTotal: grossAmount(refunds.total),
      refunds: refunds.count,
      cancellationsApproved: decisions.approved,
      cancellationsDenied: decisions.denied,
      reviewsApproved,

      recognizedRevenue: grossAmount(recognised.revenue),
      cogsVariable: grossAmount(recognised.cogsVariable),
      cogsFixed: grossAmount(fixedCost.total),
      cogsTotal: grossAmount(cogsTotal),
      // ⚠️ `toFixed(2)` chứ KHÔNG `grossAmount`: hai con số này ÂM được (tháng
      // lỗ), và tên `grossAmount` nói về tiền gross chứ không về lợi nhuận.
      // Chúng cũng không bao giờ null nên nhánh '0.00' của hàm kia là thừa.
      grossProfit: grossProfit.toFixed(2),
      grossMarginPct: grossMarginPct(grossProfit, recognised.revenue),
      taxRate: env.MARGIN_TAX_RATE,
      taxAmount: grossAmount(taxAmount),
      paymentFees: grossAmount(fees),
      netProfit: grossProfit.sub(taxAmount).sub(fees).toFixed(2),
      departuresRun: fixedCost.departures,
      costDataMissing: recognised.costMissing,
    };
  }
}
