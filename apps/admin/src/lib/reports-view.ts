import type { AdminMonthlyReport, BookingStatusValue } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { formatAmount, formatCalendarDate, statusLabel } from './bookings-view';
import { formatCount, type StatCardVM } from './stats-view';

/**
 * Mapper hiển thị báo cáo tháng (spec P4b §3-F6) — THUẦN, ngoài React, nên
 * từng con chữ trên bản in và từng ô trong file CSV đều test được.
 *
 * Ranh giới giống hệt F5: server đã cộng xong, client chỉ ĐỊNH DẠNG. Không có
 * phép cộng nào ở tầng này — kể cả tổng cột trạng thái, thứ đã có sẵn ở
 * `newBookings` của server (contract bảo đảm hai con số bằng nhau, nên bảng in
 * cả hai và chúng kiểm chéo lẫn nhau ngay trên giấy).
 *
 * Từ ADR-0034 module này chỉ phục vụ MÀN HÌNH và GIẤY. Vế "FILE nhận dữ liệu
 * thô" đã biến mất cùng `reportCsvRows`: file nay là `.xlsx` dựng ở
 * `lib/xlsx.ts`, nơi số xuống ô dưới dạng `number` kèm `numFmt` nên không cần
 * một chuỗi thô trung gian nào.
 */

const t = messages.admin.reports;

/** Một hàng của bảng phân rã trạng thái. */
export interface ReportStatusRowVM {
  status: BookingStatusValue;
  label: string;
  count: string;
}

/** Một hàng của bảng metric/value. */
export interface ReportSummaryRowVM {
  key: string;
  label: string;
  value: string;
}

/** Dòng P&L: một dòng bảng cộng vị trí của nó trong phép trừ. */
export interface ReportPnlRowVM extends ReportSummaryRowVM {
  /** Thành phần của phép trừ ngay trên nó — thụt vào một cấp. */
  indent?: boolean;
  /** Dòng KẾT QUẢ (tổng vốn, lãi gộp, lãi ròng) — in đậm. */
  emphasis?: boolean;
}

/**
 * Một dòng của bảng "Money and operations".
 *
 * Trường `raw` (dữ liệu thô cho file) đã bị gỡ ở ADR-0034: `/reports` nay xuất
 * `.xlsx` bằng `lib/xlsx.ts`, nơi số được ghi thành `number` kèm `numFmt` chứ
 * không đi qua một chuỗi trung gian nào. Nhờ vậy tầng này chỉ còn ĐÚNG một
 * việc — định dạng cho mắt người.
 */
interface SummaryMetric {
  key: string;
  label: string;
  display: (report: AdminMonthlyReport) => string;
}

const o = t.operationsTable;
const p = t.pnlTable;
const moneyMetric = (report: AdminMonthlyReport, amount: string) =>
  formatAmount(amount, report.currency);

const SUMMARY_METRICS: SummaryMetric[] = [
  {
    key: 'revenue',
    label: o.revenue,
    display: (r) => moneyMetric(r, r.revenue),
  },
  {
    key: 'paidBookings',
    label: o.paidBookings,
    display: (r) => formatCount(r.paidBookings),
  },
  {
    key: 'newBookings',
    label: o.newBookings,
    display: (r) => formatCount(r.newBookings),
  },
  // Nhóm vận hành nối thẳng vào nhóm tiền — trước ADR-0034 chúng là HAI mảng
  // vì file CSV chèn bảng phân rã trạng thái vào giữa. File Excel có sheet
  // riêng cho phân rã ấy, nên lý do tách biến mất cùng CSV.
  {
    key: 'refundedTotal',
    label: o.refundedTotal,
    display: (r) => moneyMetric(r, r.refundedTotal),
  },
  {
    key: 'refunds',
    label: o.refunds,
    display: (r) => formatCount(r.refunds),
  },
  {
    key: 'cancellationsApproved',
    label: o.cancellationsApproved,
    display: (r) => formatCount(r.cancellationsApproved),
  },
  {
    key: 'cancellationsDenied',
    label: o.cancellationsDenied,
    display: (r) => formatCount(r.cancellationsDenied),
  },
  {
    key: 'reviewsApproved',
    label: o.reviewsApproved,
    display: (r) => formatCount(r.reviewsApproved),
  },
];

/**
 * "1 Sep 2026 – 30 Sep 2026" — ngày cuối TÍNH VÀO.
 *
 * `to` của server là mốc chặn NỬA-MỞ (00:00 ngày 1 tháng sau, không tính
 * vào), nên in thẳng nó lên tiêu đề là nói với admin rằng báo cáo phủ luôn
 * ngày đầu tháng sau — sai đúng một ngày, và là kiểu sai không ai soi ra khi
 * nhìn một tờ giấy. Lùi 1ms rồi lấy phần ngày.
 */
export function reportPeriodLabel(report: AdminMonthlyReport): string {
  const { from, to } = reportPeriodDays(report);
  return t.period(formatCalendarDate(from), formatCalendarDate(to));
}

/**
 * Hai ngày lịch `YYYY-MM-DD` của kỳ báo cáo, TÍNH VÀO cả hai đầu — thứ nhãn
 * trên màn hình lẫn bộ lọc `created_at` của sheet Detail cùng dùng. Một chỗ
 * lùi 1ms: bản chép thứ hai ở route export từng là logic thuần nằm trong
 * route handler không test được (vòng vá review 05/09).
 */
export function reportPeriodDays(report: AdminMonthlyReport): { from: string; to: string } {
  return {
    from: report.from.slice(0, 10),
    to: new Date(new Date(report.to).getTime() - 1).toISOString().slice(0, 10),
  };
}

/**
 * Bốn card đầu trang. Dùng LẠI `StatCardVM` của kit F5 nhưng KHÔNG có `delta`:
 * hai tháng lịch dài khác nhau (28/29/30/31 ngày), nên một pill "±x%" ở đây sẽ
 * là phép so hai kỳ lệch độ dài — đúng thứ bất biến của stat card cấm. Caption
 * mang chính kỳ báo cáo, để mỗi card tự nói nó đo cái gì.
 */
export function toReportStatCards(report: AdminMonthlyReport): StatCardVM[] {
  const caption = reportPeriodLabel(report);
  const money = (amount: string) => formatAmount(amount, report.currency);

  // Ba card KINH DOANH rồi một card DÒNG TIỀN làm mỏ neo (ADR-0033 §1). Giữ
  // lại card cuối chứ không thay sạch: hai cách đọc đứng cạnh nhau thì người
  // đọc học được sự khác nhau, còn thay hết là đổi nghĩa trong im lặng.
  //
  // Đếm booking rời khỏi hàng card (chúng vẫn còn ở bảng vận hành bên dưới):
  // bốn ô đầu trang là chỗ đắt nhất của một tờ báo cáo, và "lãi bao nhiêu"
  // đáng chỗ ấy hơn "bao nhiêu booking".
  return [
    {
      key: 'recognizedRevenue',
      label: t.cards.recognizedRevenue,
      value: money(report.recognizedRevenue),
      caption,
    },
    {
      key: 'grossProfit',
      label: t.cards.grossProfit,
      value: money(report.grossProfit),
      // Caption mang biên % chứ không mang kỳ: một con số lãi mà không có biên
      // thì không so được với tháng khác hay với tour khác.
      caption: t.cards.marginCaption(formatMarginPct(report.grossMarginPct)),
    },
    { key: 'netProfit', label: t.cards.netProfit, value: money(report.netProfit), caption },
    { key: 'revenue', label: t.cards.revenue, value: money(report.revenue), caption },
  ];
}

/**
 * Biên gộp dạng tỉ lệ → phần trăm một chữ số.
 *
 * `null` là KHÔNG XÁC ĐỊNH (không có chuyến nào chạy trong kỳ), và nó in ra
 * một dấu gạch. In '0.0%' ở đó là nói tháng ấy hoà vốn trắng — một câu khác
 * hẳn, và sai.
 */
export function formatMarginPct(pct: number | null): string {
  return pct === null ? p.marginUnknown : `${(pct * 100).toFixed(1)}%`;
}

/**
 * Câu cảnh báo thiếu giá vốn, hoặc `null` khi dữ liệu đủ (ADR-0033 §6).
 *
 * Trả `null` chứ không trả chuỗi rỗng: nơi dùng phải quyết định KHÔNG render
 * gì cả, không phải render một dòng trống.
 */
export function costWarning(report: AdminMonthlyReport): string | null {
  const parts = [
    report.costDataMissing > 0 ? p.costMissing(formatCount(report.costDataMissing)) : null,
    // Vế thứ hai (ADR-0033 AMEND 1c): chuyến chạy mà chưa khai tiền xe cũng
    // là dữ liệu thiếu, và im lặng ở đây là phình lợi nhuận đúng bằng tiền xe.
    report.departuresCostMissing > 0
      ? p.departuresCostMissing(formatCount(report.departuresCostMissing))
      : null,
  ].filter((part): part is string => part !== null);
  return parts.length === 0 ? null : parts.join(' ');
}

/**
 * Tám hàng của bảng P&L.
 *
 * KHÔNG dùng khuôn `SummaryMetric` của hai bảng kia: nhãn dòng thuế phải mang
 * CHÍNH thuế suất của báo cáo đang đọc, tức nó phụ thuộc DỮ LIỆU — mà
 * `SummaryMetric.label` là một chuỗi hằng. Nhồi một hằng giả vào rồi thay ở
 * vòng map là để lại một cái bẫy cho người sửa sau.
 *
 * Nhãn mang thuế suất không phải trang trí: env không có ngày hiệu lực, nên
 * tờ báo cáo phải tự khai nó được tính bằng mức nào (ADR-0033 §5).
 */
export function toReportPnlRows(report: AdminMonthlyReport): ReportPnlRowVM[] {
  const money = (amount: string) => formatAmount(amount, report.currency);

  // `indent`/`emphasis` sống Ở ĐÂY cùng khoá dòng, không ở component dưới
  // dạng hai `Set` chuỗi (vòng vá review 05/09): đổi tên một `key` mà quên
  // bên kia là mất thụt/đậm trong im lặng, và tầng này có test còn JSX thì không.
  return [
    {
      key: 'recognizedRevenue',
      label: p.recognizedRevenue,
      value: money(report.recognizedRevenue),
    },
    { key: 'cogsVariable', label: p.cogsVariable, value: money(report.cogsVariable), indent: true },
    { key: 'cogsFixed', label: p.cogsFixed, value: money(report.cogsFixed), indent: true },
    { key: 'cogsTotal', label: p.cogsTotal, value: money(report.cogsTotal), emphasis: true },
    { key: 'grossProfit', label: p.grossProfit, value: money(report.grossProfit), emphasis: true },
    {
      key: 'taxAmount',
      label: p.taxAmount(formatMarginPct(report.taxRate)),
      value: money(report.taxAmount),
      indent: true,
    },
    { key: 'paymentFees', label: p.paymentFees, value: money(report.paymentFees), indent: true },
    { key: 'netProfit', label: p.netProfit, value: money(report.netProfit), emphasis: true },
  ];
}

/** Bảng phân rã lứa booking tạo trong tháng — đủ mọi trạng thái, kể cả 0. */
export function toReportStatusRows(report: AdminMonthlyReport): ReportStatusRowVM[] {
  return report.bookingsByStatus.map(({ status, count }) => ({
    status,
    label: statusLabel(status),
    count: formatCount(count),
  }));
}

/**
 * Tổng ở chân bảng phân rã — vẫn là `newBookings` của SERVER (contract bảo
 * đảm nó bằng tổng các hàng), chỉ đi qua ĐÚNG bộ định dạng mà các hàng trên
 * đang dùng. Bản đầu F6 in thẳng con số thô nên cùng một cột đọc ra
 * "1,230 / 4 / 1234" (review F6).
 */
export function reportBookingsTotal(report: AdminMonthlyReport): string {
  return formatCount(report.newBookings);
}

/** Bảng metric/value: tiền + vận hành, đã định dạng cho mắt người. */
export function toReportSummaryRows(report: AdminMonthlyReport): ReportSummaryRowVM[] {
  return SUMMARY_METRICS.map(({ key, label, display }) => ({
    key,
    label,
    value: display(report),
  }));
}
