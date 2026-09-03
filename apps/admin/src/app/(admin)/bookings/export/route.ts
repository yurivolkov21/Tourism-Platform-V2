import type { Booking } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { fetchAdminBookings, fetchAllAdminBookings } from '@/lib/api/bookings';
import { bookingsCsvRows } from '@/lib/bookings-csv';
import { EXPORT_SELECTION_PARAM, parseBookingsSearchParams } from '@/lib/bookings-query';
import { EXPORT_TIME_BUDGET_MS, type PagedExport } from '@/lib/export-pages';
import {
  csvExportResponse,
  exportFailedResponse,
  guardExportAccess,
  logExportAudit,
} from '@/lib/export-route';
import { rawSearchParamsFrom } from '@/lib/table-query';

/**
 * `GET /bookings/export` — tải CSV của ĐÚNG tập đang lọc (spec P4b §3-F6).
 *
 * Đọc cùng một `searchParams` với trang `/bookings` qua CÙNG hàm
 * `parseBookingsSearchParams`, nên "cái đang thấy" và "cái tải về" không thể
 * lệch nhau: cùng một bộ lọc, cùng một luật khoan dung với URL rác. Khác duy
 * nhất là bỏ phân trang (`bookingsExportHref` không mang page/limit — file là
 * CẢ tập, không phải trang đang xem).
 *
 * Gác quyền, audit và headers CSV là phần chung của mọi route export —
 * `lib/export-route.ts` (vòng vá review F10; lý do route phải tự gác: layout
 * không bọc route handler, proxy chỉ kiểm cookie tồn tại).
 */

// Trần thời lượng TƯỜNG MINH (vòng vá review F6 lần 2): vòng gom trang giữ
// ngân sách chung 45s (`EXPORT_TIME_BUDGET_MS`) — khai 60s ở đây để khi quá
// ngân sách, abort kịp ném vào `catch` bên dưới và admin nhận 502 CÓ LỜI,
// thay vì Vercel giết function trước và trình duyệt nhận một response cụt.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const t = messages.admin.bookings.list;
  const gate = await guardExportAccess('/bookings/export');
  if (!gate.ok) return gate.response;
  const adminId = gate.session.id;

  const query = parseBookingsSearchParams(rawSearchParamsFrom(request.nextUrl.searchParams));
  const cookie = (await cookies()).toString();
  const filters = {
    status: query.status ?? null,
    search: query.search ? '<set>' : null,
    from: query.from ?? null,
    to: query.to ?? null,
  };

  // Mã các hàng admin đã tích trên trang đang xem (spec 01/09). Có nó thì đây
  // là cú xuất CÓ CHỌN, và đường đi khác hẳn export-all bên dưới: chỉ lấy ĐÚNG
  // MỘT trang rồi giao theo mã.
  //
  // Lấy được một trang là đủ vì việc chọn khoá trong trang đang xem — phân
  // trang là điều hướng thật nên tích không sống qua trang — và
  // `bookingsExportHref` đã đính kèm `page`/`limit` cho đúng ca này. Nhờ vậy
  // xuất 3 hàng không phải đi bộ qua tối đa `EXPORT_MAX_ROWS` hàng như
  // `fetchAllAdminBookings`.
  //
  // Bộ lọc vẫn áp vì nó nằm trong cùng `query`: một hàng đã tích mà không còn
  // khớp lọc thì đơn giản không có trong trang server trả về.
  const selected = (request.nextUrl.searchParams.get(EXPORT_SELECTION_PARAM) ?? '')
    .split(',')
    .map((code) => code.trim())
    .filter(Boolean);

  if (selected.length > 0) {
    let page: Awaited<ReturnType<typeof fetchAdminBookings>>;
    try {
      // Cùng hai chốt ngân sách với export-all (`fetchAllAdminBookings`): không
      // ảnh, và một mốc thời gian để quá hạn là 502 có lời chứ không phải
      // response cụt (vòng vá review 02/09 — bản đầu bỏ cả hai).
      page = await fetchAdminBookings(
        cookie,
        { ...query, includeMedia: false },
        AbortSignal.timeout(EXPORT_TIME_BUDGET_MS),
      );
    } catch (error) {
      console.error('[admin] bookings export (selection) failed', error);
      logExportAudit('bookings', { adminId, outcome: 'failed', mode: 'selection', filters });
      return exportFailedResponse();
    }

    const wanted = new Set(selected);
    const rows = page.items.filter((item) => wanted.has(item.code));

    // Thiếu BẤT KỲ hàng nào đã chỉ đích danh: trang đã đổi dưới chân admin
    // (hàng bị huỷ rơi khỏi bộ lọc, booking mới chen vào đẩy hàng sang trang
    // sau). Trả một file ít dòng hơn số hàng đã tích là NÓI DỐI — người tải
    // tưởng mình có đủ — cùng lý do nhánh export-all từ chối bằng 413 thay vì
    // cắt bớt. Bản đầu chỉ chặn ca trượt SẠCH (0 hàng), để lọt ca trượt một
    // phần (vòng vá review 02/09). `wanted.size` chứ không phải
    // `selected.length`: mã lặp trên URL không được tính là hai hàng.
    if (rows.length !== wanted.size) {
      logExportAudit('bookings', { adminId, outcome: 'stale', mode: 'selection', filters });
      return new Response(messages.admin.errors.exportSelectionStale, { status: 409 });
    }

    // `mode` để phân biệt hai đường trong vết audit.
    logExportAudit('bookings', {
      adminId,
      outcome: 'ok',
      rows: rows.length,
      mode: 'selection',
      filters,
    });
    return csvExportResponse('nexora-bookings', bookingsCsvRows(rows));
  }

  // API sập/timeout giữa vòng lặp gom trang: KHÔNG để lỗi ném ra khỏi handler.
  // Route handler không chạy qua `app/error.tsx`, nên một ORPCError lọt ra
  // thành trang 500 HTML mặc định của Next — admin bấm nút Export rồi bị đá
  // khỏi bảng đang lọc sang một trang trắng, mất luôn bộ lọc vừa dựng và
  // không có câu nào nói "thử lại". 502 vì đây đúng là upstream hỏng.
  let result: PagedExport<Booking>;
  try {
    result = await fetchAllAdminBookings(cookie, query);
  } catch (error) {
    console.error('[admin] bookings export failed', error);
    logExportAudit('bookings', { adminId, outcome: 'failed', filters });
    return exportFailedResponse();
  }

  // Tập quá lớn: TỪ CHỐI kèm con số, không cắt bớt im lặng. Một file thiếu
  // hàng mà người xuất tưởng là đủ còn tệ hơn hẳn một lời từ chối.
  if (result.kind === 'too-large') {
    logExportAudit('bookings', { adminId, outcome: 'too-large', rows: result.total, filters });
    return new Response(t.exportTooLarge(result.total, result.max), { status: 413 });
  }
  // Tập đổi kích thước giữa vòng gom (vòng vá review F10): cùng lý do — không
  // giao một file thiếu hàng cũ nhất mà người tải tưởng là đủ.
  if (result.kind === 'changed') {
    logExportAudit('bookings', { adminId, outcome: 'changed', filters });
    return new Response(messages.admin.errors.exportListChanged, { status: 409 });
  }

  logExportAudit('bookings', { adminId, outcome: 'ok', rows: result.items.length, filters });
  return csvExportResponse('nexora-bookings', bookingsCsvRows(result.items));
}
