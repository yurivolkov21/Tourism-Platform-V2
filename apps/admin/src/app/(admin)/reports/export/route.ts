import type { AdminMonthlyReport } from '@tourism/contract';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { fetchAllAdminBookings } from '@/lib/api/bookings';
import { fetchAdminMonthlyReport } from '@/lib/api/reports';
import {
  exportFailedResponse,
  guardExportAccess,
  logExportAudit,
  xlsxExportResponse,
} from '@/lib/export-route';
import { parseReportsSearchParams } from '@/lib/reports-query';
import { rawSearchParamsFrom } from '@/lib/table-query';
import { buildReportWorkbook } from '@/lib/xlsx';

/**
 * `GET /reports/export` — tải file **Excel** của đúng tháng đang xem.
 *
 * Đổi từ CSV sang `.xlsx` ở ADR-0034 (05/09, góp ý giảng viên). Đổi ĐỊNH DẠNG
 * phản hồi, KHÔNG đổi hợp đồng: vẫn đọc `?month=` bằng CHÍNH
 * `parseReportsSearchParams` của trang (không có bản parse thứ hai để trôi
 * lệch), vẫn tự gác quyền vì route handler KHÔNG chạy qua `(admin)/layout.tsx`,
 * và vẫn trả 401/403/502 dạng text chứ không redirect — một cú tải file mà bị
 * đá sang `/login` chỉ để lại một file HTML mang đuôi `.xlsx`.
 */
export async function GET(request: NextRequest) {
  const gate = await guardExportAccess('/reports/export');
  if (!gate.ok) return gate.response;

  const { month } = parseReportsSearchParams(
    rawSearchParamsFrom(request.nextUrl.searchParams),
    new Date(),
  );
  const cookie = (await cookies()).toString();

  // Route handler không đi qua `app/error.tsx`, nên API hỏng mà không bắt ở
  // đây sẽ thành trang 500 HTML thay vì một câu nói rõ là chưa tải được gì.
  let report: AdminMonthlyReport;
  try {
    report = await fetchAdminMonthlyReport(cookie, month);
  } catch (error) {
    console.error('[admin] monthly report export failed', error);
    logExportAudit('reports', { adminId: gate.session.id, outcome: 'failed', filters: { month } });
    return exportFailedResponse();
  }

  // Sheet *Detail* — dùng LẠI `fetchAllAdminBookings` mà `/bookings/export`
  // đang dùng: nó đã ôm sẵn vòng lặp phân trang, ngân sách thời gian và luật
  // dedupe (`lib/export-pages.ts`), thứ vùng bookings trả giá hai vòng review
  // mới viết đúng.
  //
  // ⚠️ Khoảng ngày lọc theo `created_at` (ADR-0028 chốt giữ cột ấy), nên tập
  // này là booking TẠO trong tháng — cùng tập với sheet *Bookings*, KHÔNG phải
  // tập của khối P&L vốn neo ngày chuyến kết thúc. Tên sheet nói thẳng điều
  // đó; xem JSDoc `buildDetail`.
  //
  // `report.to` là mốc NỬA-MỞ (00:00 ngày 1 tháng sau) nên phải lùi 1ms rồi
  // cắt ngày — đúng phép `reportPeriodLabel` đang làm cho nhãn trên màn hình.
  const lastDay = new Date(new Date(report.to).getTime() - 1).toISOString().slice(0, 10);
  let detail: Awaited<ReturnType<typeof fetchAllAdminBookings>>;
  try {
    detail = await fetchAllAdminBookings(cookie, {
      page: 1,
      limit: 20,
      from: report.from.slice(0, 10),
      to: lastDay,
    });
  } catch (error) {
    console.error('[admin] monthly report detail fetch failed', error);
    logExportAudit('reports', { adminId: gate.session.id, outcome: 'failed', filters: { month } });
    return exportFailedResponse();
  }

  // Tập booking quá lớn hoặc đổi kích thước giữa chừng: file VẪN đi, chỉ là
  // không có sheet Detail. Khác hẳn `/bookings/export` — ở đó Detail LÀ file
  // nên thiếu nó là 413/409; ở đây nó là một trong năm sheet, và chặn cả báo
  // cáo tháng vì một sheet phụ là đổi một bất tiện thành một cú tải hỏng.
  //
  // Nhưng KHÔNG được im lặng: vết audit ghi đúng kết cục để "file tôi tải
  // thiếu sheet Detail" trả lời được khi có người hỏi.
  const rows = detail.kind === 'rows' ? detail.items : [];
  if (detail.kind !== 'rows') {
    logExportAudit('reports', {
      adminId: gate.session.id,
      outcome: detail.kind === 'too-large' ? 'too-large' : 'changed',
      mode: 'detail-sheet-skipped',
      filters: { month },
    });
  }

  // Tên file mang CẢ tháng báo cáo lẫn ngày xuất: hai bản tải cùng một tháng ở
  // hai ngày khác nhau là hai ảnh chụp khác nhau (phân rã trạng thái đổi theo
  // thời gian — xem `definitions.statuses`), nên chúng không được trùng tên.
  logExportAudit('reports', {
    adminId: gate.session.id,
    outcome: 'ok',
    rows: rows.length,
    filters: { month },
  });
  return xlsxExportResponse(
    `nexora-report-${report.month}`,
    await buildReportWorkbook(report, rows),
  );
}
