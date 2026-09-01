import { messages } from '@tourism/i18n';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { decideAdminAccess } from '@/lib/admin-gate';
import { fetchAllAdminBookings } from '@/lib/api/bookings';
import { getServerSession } from '@/lib/api/session';
import { bookingsCsvRows } from '@/lib/bookings-csv';
import { parseBookingsSearchParams } from '@/lib/bookings-query';
import { CSV_CONTENT_TYPE, csvDocument, csvFilename, isoDay } from '@/lib/csv';
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
 * ## Gác quyền phải làm TẠI ĐÂY
 *
 * Route handler KHÔNG chạy qua `(admin)/layout.tsx` — layout chỉ bọc page.
 * Nếu ở đây không tự gọi `getServerSession` + `decideAdminAccess` thì mọi
 * người đăng nhập (kể cả khách thường) tải được toàn bộ booking của mọi
 * người: đúng cái lỗ mà layout đang bịt cho các trang. Proxy chỉ kiểm cookie
 * TỒN TẠI, không kiểm role.
 *
 * Trả 401/403 dạng text chứ không redirect: đây là một cú tải file, và
 * redirect sang `/login` chỉ làm trình duyệt lưu một file HTML tên .csv.
 */
export async function GET(request: NextRequest) {
  const t = messages.admin.bookings.list;
  const session = await getServerSession();
  const decision = decideAdminAccess(session ? { role: session.role } : null, '/bookings/export');
  if (decision.kind === 'login') {
    return new Response(messages.admin.errors.write.UNAUTHORIZED, { status: 401 });
  }
  if (decision.kind === 'deny') {
    return new Response(messages.admin.errors.write.FORBIDDEN, { status: 403 });
  }

  const query = parseBookingsSearchParams(rawSearchParamsFrom(request.nextUrl.searchParams));
  const cookie = (await cookies()).toString();
  const result = await fetchAllAdminBookings(cookie, query);

  // Tập quá lớn: TỪ CHỐI kèm con số, không cắt bớt im lặng. Một file thiếu
  // hàng mà người xuất tưởng là đủ còn tệ hơn hẳn một lời từ chối.
  if (result.kind === 'too-large') {
    return new Response(t.exportTooLarge(result.total, result.max), { status: 413 });
  }

  const filename = csvFilename('nexora-bookings', isoDay(new Date()));
  return new Response(csvDocument(bookingsCsvRows(result.bookings)), {
    headers: {
      'content-type': CSV_CONTENT_TYPE,
      'content-disposition': `attachment; filename="${filename}"`,
      // Dữ liệu back-office, và mỗi lần bấm là một ảnh chụp khác — không có
      // gì ở đây được phép nằm lại trong cache trình duyệt/proxy.
      'cache-control': 'no-store',
    },
  });
}
