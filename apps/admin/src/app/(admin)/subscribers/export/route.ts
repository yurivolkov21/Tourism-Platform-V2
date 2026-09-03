import { messages } from '@tourism/i18n';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { decideAdminAccess } from '@/lib/admin-gate';
import { lookupServerSession } from '@/lib/api/session';
import { type AdminSubscribersExport, fetchAllAdminSubscribers } from '@/lib/api/subscribers';
import { csvAttachmentHeaders, csvDocument, csvFilename, isoDay } from '@/lib/csv';
import { subscribersCsvRows } from '@/lib/subscribers-csv';
import { parseSubscribersSearchParams } from '@/lib/subscribers-query';
import { rawSearchParamsFrom } from '@/lib/table-query';

/**
 * `GET /subscribers/export` — tải CSV của ĐÚNG tập đang lọc (spec P4c §3-F10).
 *
 * Đọc cùng một `searchParams` với trang `/subscribers` qua CÙNG hàm
 * `parseSubscribersSearchParams`, nên "cái đang thấy" và "cái tải về" không
 * thể lệch nhau: cùng bộ lọc, cùng luật khoan dung với URL rác. Khác duy nhất
 * là bỏ phân trang (`subscribersExportHref` không mang page/limit — file là
 * CẢ tập, không phải trang đang xem).
 *
 * ## Gác quyền phải làm TẠI ĐÂY
 *
 * Route handler KHÔNG chạy qua `(admin)/layout.tsx` — layout chỉ bọc page.
 * Nếu ở đây không tự gọi `lookupServerSession` + `decideAdminAccess` thì mọi
 * người đăng nhập (kể cả khách thường) tải được cả danh sách email: đúng cái
 * lỗ mà layout đang bịt cho các trang. Proxy chỉ kiểm cookie TỒN TẠI, không
 * kiểm role.
 *
 * Trả 401/403 dạng text chứ không redirect: đây là một cú tải file, và
 * redirect sang `/login` chỉ làm trình duyệt lưu một file HTML tên .csv.
 */

// Trần thời lượng TƯỜNG MINH (cùng lý do với `/bookings/export`): vòng gom
// trang giữ ngân sách chung 45s (`EXPORT_TIME_BUDGET_MS`) — khai 60s ở đây để
// khi quá ngân sách, abort kịp ném vào `catch` bên dưới và admin nhận 502 CÓ
// LỜI, thay vì nền tảng giết function trước và trình duyệt nhận response cụt.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const t = messages.admin.subscribers.list;
  const lookup = await lookupServerSession();
  // Check phiên cũng đi QUA API — API sập thì phải nói thật là API sập (vòng
  // vá review F6): gộp nó vào "chưa đăng nhập" là bảo admin đi đăng nhập lại
  // vô ích, và nhánh 502 phía dưới không bao giờ chạy đúng kịch bản của nó.
  if (lookup.kind === 'unreachable') {
    return new Response(messages.admin.errors.exportFailed, { status: 502 });
  }
  const session = lookup.kind === 'ok' ? lookup.user : null;
  const decision = decideAdminAccess(
    session ? { role: session.role } : null,
    '/subscribers/export',
  );
  if (decision.kind === 'login') {
    return new Response(messages.admin.errors.write.UNAUTHORIZED, { status: 401 });
  }
  if (decision.kind === 'deny') {
    return new Response(messages.admin.errors.write.FORBIDDEN, { status: 403 });
  }

  const query = parseSubscribersSearchParams(rawSearchParamsFrom(request.nextUrl.searchParams));
  const cookie = (await cookies()).toString();

  // API sập/timeout giữa vòng lặp gom trang: KHÔNG để lỗi ném ra khỏi handler.
  // Route handler không chạy qua `app/error.tsx`, nên một ORPCError lọt ra
  // thành trang 500 HTML mặc định của Next — admin bấm nút Export rồi bị đá
  // khỏi bảng đang lọc sang một trang trắng. 502 vì đây đúng là upstream hỏng.
  let result: AdminSubscribersExport;
  try {
    result = await fetchAllAdminSubscribers(cookie, query);
  } catch (error) {
    console.error('[admin] subscribers export failed', error);
    return new Response(messages.admin.errors.exportFailed, { status: 502 });
  }

  // Tập quá lớn: TỪ CHỐI kèm con số, không cắt bớt im lặng. Một file thiếu
  // hàng mà người xuất tưởng là đủ còn tệ hơn hẳn một lời từ chối.
  if (result.kind === 'too-large') {
    return new Response(t.exportTooLarge(result.total, result.max), { status: 413 });
  }

  // Vết cho một cú xuất PII hàng loạt (cùng nếp `/bookings/export`): mọi hành
  // vi GHI của admin đều quy được về người, còn cú ĐỌC này mang địa chỉ email
  // của cả tập lọc — "ai tải, lúc nào, bộ lọc gì" phải trả lời được khi điều
  // tra. Log CÓ CẤU TRÚC và KHÔNG chép PII: `search` chỉ ghi là có/không, vì
  // chính nó thường là một địa chỉ email.
  console.info(
    '[admin] subscribers export',
    JSON.stringify({
      adminId: session?.id ?? null,
      rows: result.items.length,
      filters: {
        active: query.active ?? null,
        search: query.search ? '<set>' : null,
        source: query.source ?? null,
      },
    }),
  );

  const filename = csvFilename('nexora-subscribers', isoDay(new Date()));
  return new Response(csvDocument(subscribersCsvRows(result.items)), {
    headers: csvAttachmentHeaders(filename),
  });
}
