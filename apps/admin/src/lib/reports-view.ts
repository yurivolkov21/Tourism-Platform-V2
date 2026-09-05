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
 * Hai đích, hai hàm: MÀN HÌNH/GIẤY nhận chữ đã định dạng ('$1,240.50'), FILE
 * nhận dữ liệu thô ('1240.50'). Cùng lý do đã ghi ở `bookings-csv.ts` — Excel
 * đọc '$1,240.50' thành text và mọi phép SUM chết.
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

/**
 * MỘT bảng mô tả cho danh sách metric của bảng vận hành — nguồn CHUNG của
 * `toReportSummaryRows` (màn hình/giấy) và `reportCsvRows` (file). Trước vòng
 * vá review F6 hai hàm khai hai danh sách rời phải giữ đồng bộ bằng tay:
 * thêm một metric vào bảng mà quên CSV thì màn hình có, file thiếu, và không
 * test nào đỏ. Giờ mỗi metric khai MỘT lần với hai cách đọc: `display` cho
 * mắt ('$1,240.50'), `raw` cho Excel ('1240.50' — lý do ở JSDoc
 * `reportCsvRows`).
 *
 * Tách hai nhóm vì CSV chèn bảng phân rã trạng thái vào GIỮA: nhóm bookings
 * (doanh thu + đếm booking) đứng trước phân rã, nhóm vận hành (hoàn tiền,
 * quyết định huỷ, duyệt review) đứng sau — đúng thứ tự người đọc dò một tờ
 * báo cáo.
 */
interface SummaryMetric {
  key: string;
  label: string;
  raw: (report: AdminMonthlyReport) => string;
  display: (report: AdminMonthlyReport) => string;
}

const o = t.operationsTable;
const p = t.pnlTable;
const moneyMetric = (report: AdminMonthlyReport, amount: string) =>
  formatAmount(amount, report.currency);

const BOOKINGS_METRICS: SummaryMetric[] = [
  {
    key: 'revenue',
    label: o.revenue,
    raw: (r) => r.revenue,
    display: (r) => moneyMetric(r, r.revenue),
  },
  {
    key: 'paidBookings',
    label: o.paidBookings,
    raw: (r) => String(r.paidBookings),
    display: (r) => formatCount(r.paidBookings),
  },
  {
    key: 'newBookings',
    label: o.newBookings,
    raw: (r) => String(r.newBookings),
    display: (r) => formatCount(r.newBookings),
  },
];

const OPERATIONS_METRICS: SummaryMetric[] = [
  {
    key: 'refundedTotal',
    label: o.refundedTotal,
    raw: (r) => r.refundedTotal,
    display: (r) => moneyMetric(r, r.refundedTotal),
  },
  {
    key: 'refunds',
    label: o.refunds,
    raw: (r) => String(r.refunds),
    display: (r) => formatCount(r.refunds),
  },
  {
    key: 'cancellationsApproved',
    label: o.cancellationsApproved,
    raw: (r) => String(r.cancellationsApproved),
    display: (r) => formatCount(r.cancellationsApproved),
  },
  {
    key: 'cancellationsDenied',
    label: o.cancellationsDenied,
    raw: (r) => String(r.cancellationsDenied),
    display: (r) => formatCount(r.cancellationsDenied),
  },
  {
    key: 'reviewsApproved',
    label: o.reviewsApproved,
    raw: (r) => String(r.reviewsApproved),
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
  const lastDay = new Date(new Date(report.to).getTime() - 1).toISOString().slice(0, 10);
  return t.period(formatCalendarDate(report.from.slice(0, 10)), formatCalendarDate(lastDay));
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
  return report.costDataMissing === 0 ? null : p.costMissing(formatCount(report.costDataMissing));
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
export function toReportPnlRows(report: AdminMonthlyReport): ReportSummaryRowVM[] {
  const money = (amount: string) => formatAmount(amount, report.currency);

  return [
    {
      key: 'recognizedRevenue',
      label: p.recognizedRevenue,
      value: money(report.recognizedRevenue),
    },
    { key: 'cogsVariable', label: p.cogsVariable, value: money(report.cogsVariable) },
    { key: 'cogsFixed', label: p.cogsFixed, value: money(report.cogsFixed) },
    { key: 'cogsTotal', label: p.cogsTotal, value: money(report.cogsTotal) },
    { key: 'grossProfit', label: p.grossProfit, value: money(report.grossProfit) },
    {
      key: 'taxAmount',
      label: p.taxAmount(formatMarginPct(report.taxRate)),
      value: money(report.taxAmount),
    },
    { key: 'paymentFees', label: p.paymentFees, value: money(report.paymentFees) },
    { key: 'netProfit', label: p.netProfit, value: money(report.netProfit) },
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
  return [...BOOKINGS_METRICS, ...OPERATIONS_METRICS].map(({ key, label, display }) => ({
    key,
    label,
    value: display(report),
  }));
}

/**
 * File CSV của báo cáo: hai cột `Metric,Value`.
 *
 * Hình dạng dọc (mỗi metric một hàng) chứ không phải một hàng rộng: người mở
 * file này đọc từng con số hoặc dán vài tháng cạnh nhau, và một header 15 cột
 * thì phải cuộn ngang mới biết mình đang nhìn ô nào.
 *
 * Bốn hàng đầu là SIÊU DỮ LIỆU kỳ. File rời khỏi màn hình rồi vẫn phải tự nói
 * được nó là tháng nào và chốt lúc nào — không có siêu dữ liệu thì hai file
 * tải ở hai tháng khác nhau trông y hệt nhau.
 *
 * Giá trị là DỮ LIỆU THÔ: tiền '1240.50' (không ký hiệu, không phân cách
 * nghìn), mốc thời gian ISO UTC, trạng thái là member enum.
 */
export function reportCsvRows(report: AdminMonthlyReport): string[][] {
  const c = t.csv;
  const metricRow = ({ label, raw }: SummaryMetric): string[] => [label, raw(report)];

  return [
    [c.metric, c.value],
    [c.month, report.month],
    [c.periodFrom, report.from],
    [c.periodTo, report.to],
    [c.generatedAt, report.generatedAt],
    [c.currency, report.currency],
    ...BOOKINGS_METRICS.map(metricRow),
    ...report.bookingsByStatus.map(({ status, count }): string[] => [
      c.statusRow(status),
      String(count),
    ]),
    ...OPERATIONS_METRICS.map(metricRow),
  ];
}
