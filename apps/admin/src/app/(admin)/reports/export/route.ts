import type { AdminMonthlyReport } from '@tourism/contract';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { fetchAdminMonthlyReport } from '@/lib/api/reports';
import {
  csvExportResponse,
  exportFailedResponse,
  guardExportAccess,
  logExportAudit,
} from '@/lib/export-route';
import { parseReportsSearchParams } from '@/lib/reports-query';
import { reportCsvRows } from '@/lib/reports-view';
import { rawSearchParamsFrom } from '@/lib/table-query';

/**
 * `GET /reports/export` — tải CSV của đúng tháng đang xem (spec P4b §3-F6).
 *
 * Cùng khuôn với `/bookings/export`: đọc `?month=` bằng CHÍNH
 * `parseReportsSearchParams` của trang (không có bản parse thứ hai để trôi
 * lệch), tự gác quyền vì route handler KHÔNG chạy qua `(admin)/layout.tsx`,
 * và trả 401/403 dạng text chứ không redirect — một cú tải file mà bị đá sang
 * `/login` chỉ để lại một file HTML mang đuôi .csv.
 *
 * Không có trần kích thước như export bookings: báo cáo luôn là ~20 hàng cố
 * định, không phụ thuộc lượng dữ liệu.
 */
export async function GET(request: NextRequest) {
  const gate = await guardExportAccess('/reports/export');
  if (!gate.ok) return gate.response;

  const { month } = parseReportsSearchParams(
    rawSearchParamsFrom(request.nextUrl.searchParams),
    new Date(),
  );
  const cookie = (await cookies()).toString();

  // Cùng lý do với `/bookings/export`: route handler không đi qua
  // `app/error.tsx`, nên API hỏng mà không bắt ở đây sẽ thành trang 500 HTML
  // thay vì một câu nói rõ là chưa tải được gì.
  let report: AdminMonthlyReport;
  try {
    report = await fetchAdminMonthlyReport(cookie, month);
  } catch (error) {
    console.error('[admin] monthly report export failed', error);
    logExportAudit('reports', { adminId: gate.session.id, outcome: 'failed', filters: { month } });
    return exportFailedResponse();
  }

  // Tên file mang CẢ tháng báo cáo lẫn ngày xuất: hai bản tải cùng một tháng ở
  // hai ngày khác nhau là hai ảnh chụp khác nhau (phân rã trạng thái đổi theo
  // thời gian — xem `definitions.statuses`), nên chúng không được trùng tên.
  // Vết audit cho cả báo cáo (vòng vá review F10 — route này từng không ghi).
  logExportAudit('reports', { adminId: gate.session.id, outcome: 'ok', filters: { month } });
  return csvExportResponse(`nexora-report-${report.month}`, reportCsvRows(report));
}
