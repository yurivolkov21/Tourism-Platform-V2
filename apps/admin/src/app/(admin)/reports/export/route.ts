import type { AdminMonthlyReport } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { decideAdminAccess } from '@/lib/admin-gate';
import { fetchAdminMonthlyReport } from '@/lib/api/reports';
import { getServerSession } from '@/lib/api/session';
import { csvAttachmentHeaders, csvDocument, csvFilename, isoDay } from '@/lib/csv';
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
  const session = await getServerSession();
  const decision = decideAdminAccess(session ? { role: session.role } : null, '/reports/export');
  if (decision.kind === 'login') {
    return new Response(messages.admin.errors.write.UNAUTHORIZED, { status: 401 });
  }
  if (decision.kind === 'deny') {
    return new Response(messages.admin.errors.write.FORBIDDEN, { status: 403 });
  }

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
    return new Response(messages.admin.errors.exportFailed, { status: 502 });
  }

  // Tên file mang CẢ tháng báo cáo lẫn ngày xuất: hai bản tải cùng một tháng ở
  // hai ngày khác nhau là hai ảnh chụp khác nhau (phân rã trạng thái đổi theo
  // thời gian — xem `definitions.statuses`), nên chúng không được trùng tên.
  const filename = csvFilename(`nexora-report-${report.month}`, isoDay(new Date()));
  return new Response(csvDocument(reportCsvRows(report)), {
    headers: csvAttachmentHeaders(filename),
  });
}
