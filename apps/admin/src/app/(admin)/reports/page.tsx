import { messages } from '@tourism/i18n';
import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { AdminShell } from '@/components/admin-shell';
import { StatCardRow } from '@/components/kit/stat-card';
import { ReportPrint } from '@/components/reports/report-print';
import { ReportTables } from '@/components/reports/report-tables';
import { ReportsToolbar } from '@/components/reports/reports-toolbar';
import { fetchAdminMonthlyReport } from '@/lib/api/reports';
import { getServerSession } from '@/lib/api/session';
import { formatDateTime } from '@/lib/bookings-view';
import { reportPrintView } from '@/lib/report-print';
import { formatMonthLabel, monthOptions, parseReportsSearchParams } from '@/lib/reports-query';
import { reportPeriodLabel, toReportStatCards } from '@/lib/reports-view';
import type { RawSearchParams } from '@/lib/table-query';

/**
 * `/reports` — báo cáo THÁNG (spec P4b §3-F6).
 *
 * Server component đúng nếp ba trang vùng: `?month=YYYY-MM` → input contract →
 * fetch oRPC kèm cookie forward → truyền số đã format xuống các mảnh hiển thị.
 * Không có state báo cáo nào ở client, nên mọi tháng đều share/bookmark được.
 *
 * ## Màn hình và giấy
 *
 * "Xuất PDF" của F6 chính là Print của trình duyệt (đường 0-dependency, user
 * chốt 31/08 — không thêm thư viện PDF nào trước freeze 15/10). Từ G40 Phần 2
 * (ADR-0057 §1) giấy là một tờ riêng: `ReportPrint` — bản in C2, chỉ hiện khi
 * in — đứng cạnh nội dung màn hình, còn nội dung màn hình bọc `print:hidden`.
 * Hai bộ markup đọc cùng một báo cáo qua hai view-model thuần
 * (`reports-view`, `report-print`), nên không bên nào tự tính số.
 *
 * Màn hình giữ hai điều F6 đặt ra từ thời in thẳng trang này, vì chúng vẫn
 * đúng khi đọc trên màn hình:
 *
 * - Tiêu đề + kỳ + mốc chốt sổ nằm TRONG trang, không chỉ trên topbar: ảnh
 *   chụp hay bản chép của trang phải tự nói nó là báo cáo tháng nào, chốt lúc
 *   nào.
 * - Khối "How to read these numbers" đi kèm. Ba định nghĩa dễ hiểu nhầm nhất
 *   (doanh thu gross neo theo ngày trả tiền · hoàn tiền là dòng ra chứ không
 *   phải phép trừ · phân rã trạng thái là ảnh chụp hôm nay) không có tooltip
 *   nào để hỏi.
 */
const t = messages.admin.reports;

export const metadata: Metadata = {
  title: 'Reports — Nexora back office',
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  // MỘT mốc "bây giờ" cho cả trang: dùng hai lần `new Date()` thì ô chọn
  // tháng và tháng mặc định có thể rơi hai bên nửa đêm cuối tháng.
  const now = new Date();
  const query = parseReportsSearchParams(await searchParams, now);
  const cookie = (await cookies()).toString();
  const [session, report] = await Promise.all([
    getServerSession(),
    fetchAdminMonthlyReport(cookie, query.month),
  ]);
  // Null chỉ xảy ra khi phiên hết hạn ngay giữa hai request — layout xử lý ở
  // lần điều hướng kế (cùng nếp ba trang vùng).
  if (!session) return null;

  return (
    <AdminShell user={session}>
      {/* `contents`: con vẫn là phần tử flex của vỏ như trước; `print:hidden`: giấy chỉ còn tờ in. */}
      <div className="contents print:hidden">
        <ReportsToolbar month={query.month} options={monthOptions(now, 12, query.month)} />

        <header className="flex flex-col gap-1 px-4 lg:px-6">
          <h2 className="text-xl font-semibold">
            {t.title} — {formatMonthLabel(report.month)}
          </h2>
          <p className="text-sm text-muted-foreground">{reportPeriodLabel(report)}</p>
          <p className="text-sm text-muted-foreground">
            {t.generatedAt(formatDateTime(report.generatedAt))}
          </p>
        </header>

        <StatCardRow cards={toReportStatCards(report)} />
        <ReportTables report={report} />

        <section className="flex flex-col gap-1 px-4 text-sm text-muted-foreground lg:px-6">
          <h3 className="font-medium text-foreground">{t.definitions.heading}</h3>
          <p>{t.definitions.revenue}</p>
          <p>{t.definitions.refunds}</p>
          <p>{t.definitions.statuses}</p>
          <p>{t.definitions.cancellations}</p>
          <p>{t.definitions.recognised}</p>
          <p>{t.definitions.costs}</p>
          <p>{t.definitions.netProfit}</p>
        </section>
      </div>

      <ReportPrint view={reportPrintView(report)} />
    </AdminShell>
  );
}
