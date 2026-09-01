import type { AdminMonthlyReport } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@tourism/ui/components/table';
import { reportBookingsTotal, toReportStatusRows, toReportSummaryRows } from '@/lib/reports-view';

/**
 * Hai bảng của báo cáo tháng (spec P4b §3-F6) — server component, không state,
 * không tính toán: `reports-view.ts` (thuần, có test) đã nấu sẵn từng ô.
 *
 * Kiểu dáng bê từ `DataTableFrame` của kit (viền bo góc, `px-4 lg:px-6`) chứ
 * không dùng chính nó: `DataTableFrame` có bốn khe cho một bảng-đọc-từ-server
 * (tab lọc · hành động · phân trang) mà báo cáo không có khe nào — nhét vào sẽ
 * là ba khe rỗng. Cái phải giống nhau là VẺ NGOÀI, và nó giống.
 *
 * Mỗi bảng có tiêu đề THẤY ĐƯỢC: bản in không còn sidebar lẫn topbar, nên
 * không có gì khác nói cho người cầm tờ giấy biết cột số này đếm cái gì.
 */
const t = messages.admin.reports;

export function ReportTables({ report }: { report: AdminMonthlyReport }) {
  const statusRows = toReportStatusRows(report);
  const summaryRows = toReportSummaryRows(report);

  return (
    <div className="grid gap-4 px-4 lg:px-6 @4xl/main:grid-cols-2 print:grid-cols-2">
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">{t.bookingsTable.heading}</h3>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead>{t.bookingsTable.status}</TableHead>
                <TableHead className="text-right">{t.bookingsTable.count}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statusRows.map((row) => (
                <TableRow key={row.status}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.count}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                {/* Tổng ở đây là `newBookings` của SERVER, không phải phép cộng
                    của client: contract bảo đảm hai con số bằng nhau, nên in cả
                    hai là để chúng kiểm chéo nhau ngay trên giấy. */}
                <TableCell>{t.bookingsTable.total}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {reportBookingsTotal(report)}
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
        {report.newBookings === 0 ? (
          <p className="text-sm text-muted-foreground">{t.bookingsTable.empty}</p>
        ) : null}
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium">{t.operationsTable.heading}</h3>
        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted">
              <TableRow>
                <TableHead>{t.operationsTable.metric}</TableHead>
                <TableHead className="text-right">{t.operationsTable.value}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summaryRows.map((row) => (
                <TableRow key={row.key}>
                  <TableCell>{row.label}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.value}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
