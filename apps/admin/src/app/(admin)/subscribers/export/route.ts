import type { SubscriberRow } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import { fetchAdminSubscribers, fetchAllAdminSubscribers } from '@/lib/api/subscribers';
import { EXPORT_TIME_BUDGET_MS, type PagedExport } from '@/lib/export-pages';
import {
  exportFailedResponse,
  guardExportAccess,
  logExportAudit,
  xlsxAfterBuild,
} from '@/lib/export-route';
import { parseExportSelection, pickSelectedRows } from '@/lib/export-selection';
import { parseSubscribersSearchParams } from '@/lib/subscribers-query';
import { buildSubscribersWorkbook } from '@/lib/subscribers-xlsx';
import { rawSearchParamsFrom } from '@/lib/table-query';

/**
 * `GET /subscribers/export` — tải Excel của ĐÚNG tập đang lọc (spec P4c §3-F10).
 *
 * Đọc cùng một `searchParams` với trang `/subscribers` qua CÙNG hàm
 * `parseSubscribersSearchParams`, nên "cái đang thấy" và "cái tải về" không
 * thể lệch nhau: cùng bộ lọc, cùng luật khoan dung với URL rác — kể cả mặc
 * định tab Active khi URL không nói gì (vòng vá review F10: bản đầu URL trần
 * là tab All, tức một bookmark `/subscribers` xuất luôn cả địa chỉ đã rút
 * consent). Khác duy nhất là bỏ phân trang (`subscribersExportHref` không
 * mang page/limit — file là CẢ tập, không phải trang đang xem), trừ cú xuất
 * CÓ CHỌN (G43) bên dưới.
 *
 * Gác quyền, audit và headers tải file là phần chung của mọi route export —
 * `lib/export-route.ts` (lý do route phải tự gác: layout không bọc route
 * handler, proxy chỉ kiểm cookie tồn tại).
 */

// Trần thời lượng TƯỜNG MINH (cùng lý do với `/bookings/export`): vòng gom
// trang giữ ngân sách chung 45s (`EXPORT_TIME_BUDGET_MS`) — khai 60s ở đây để
// khi quá ngân sách, abort kịp ném vào `catch` bên dưới và admin nhận 502 CÓ
// LỜI, thay vì nền tảng giết function trước và trình duyệt nhận response cụt.
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const t = messages.admin.subscribers.list;
  const gate = await guardExportAccess('/subscribers/export');
  if (!gate.ok) return gate.response;
  const adminId = gate.session.id;

  const query = parseSubscribersSearchParams(rawSearchParamsFrom(request.nextUrl.searchParams));
  const cookie = (await cookies()).toString();
  const generatedAt = new Date().toISOString();
  // `active` vắng = tab All, và đó là lựa chọn CÓ CHỦ ĐÍCH của admin (mặc
  // định là Active) — ghi 'all' để vết audit nói đúng tập đã xuất.
  const filters = {
    active: query.active === undefined ? 'all' : query.active,
    search: query.search ? '<set>' : null,
    source: query.source ?? null,
    from: query.from ?? null,
    to: query.to ?? null,
  };

  // Id các hàng admin đã tích trên trang đang xem (G43, khuôn `/bookings/export`
  // 01/09). Có nó thì chỉ lấy ĐÚNG MỘT trang rồi giao theo id: việc chọn khoá
  // trong trang đang xem và `subscribersExportHref` đã đính kèm `page`/`limit`.
  // Bộ lọc vẫn áp vì nó nằm trong cùng `query`: hàng đã tích mà không còn khớp
  // lọc (vừa bị gỡ khỏi tab Active chẳng hạn) thì không có trong trang trả về.
  const selected = parseExportSelection(request.nextUrl.searchParams);

  if (selected.length > 0) {
    let page: Awaited<ReturnType<typeof fetchAdminSubscribers>>;
    try {
      // Cùng hai chốt ngân sách với vòng gom cả tập: không kèm danh sách nguồn,
      // và một mốc thời gian để quá hạn là 502 có lời chứ không phải response cụt.
      page = await fetchAdminSubscribers(
        cookie,
        { ...query, includeSources: false },
        AbortSignal.timeout(EXPORT_TIME_BUDGET_MS),
      );
    } catch (error) {
      console.error('[admin] subscribers export (selection) failed', error);
      logExportAudit('subscribers', { adminId, outcome: 'failed', mode: 'selection', filters });
      return exportFailedResponse();
    }

    // Thiếu BẤT KỲ hàng nào đã tích là 409, không giao file thiếu hàng — luật
    // đầy đủ ở `pickSelectedRows`.
    const rows = pickSelectedRows(page.items, selected, (row) => row.id);
    if (!rows) {
      logExportAudit('subscribers', { adminId, outcome: 'stale', mode: 'selection', filters });
      return new Response(messages.admin.errors.exportSelectionStale, { status: 409 });
    }

    // `mode` để phân biệt hai đường trong vết audit.
    return xlsxAfterBuild(
      'subscribers',
      { adminId, rows: rows.length, mode: 'selection', filters },
      'nexora-subscribers',
      () => buildSubscribersWorkbook(rows, { query, selected: rows.length, generatedAt }),
    );
  }

  // API sập/timeout giữa vòng lặp gom trang: KHÔNG để lỗi ném ra khỏi handler.
  // Route handler không chạy qua `app/error.tsx`, nên một ORPCError lọt ra
  // thành trang 500 HTML mặc định của Next — admin bấm nút Export rồi bị đá
  // khỏi bảng đang lọc sang một trang trắng. 502 vì đây đúng là upstream hỏng.
  let result: PagedExport<SubscriberRow>;
  try {
    result = await fetchAllAdminSubscribers(cookie, query);
  } catch (error) {
    console.error('[admin] subscribers export failed', error);
    logExportAudit('subscribers', { adminId, outcome: 'failed', filters });
    return exportFailedResponse();
  }

  // Tập quá lớn: TỪ CHỐI kèm con số, không cắt bớt im lặng. Một file thiếu
  // hàng mà người xuất tưởng là đủ còn tệ hơn hẳn một lời từ chối.
  if (result.kind === 'too-large') {
    logExportAudit('subscribers', { adminId, outcome: 'too-large', rows: result.total, filters });
    return new Response(t.exportTooLarge(result.total, result.max), { status: 413 });
  }
  // Tập đổi kích thước giữa vòng gom (vòng vá review F10) — cùng lý do.
  if (result.kind === 'changed') {
    logExportAudit('subscribers', { adminId, outcome: 'changed', filters });
    return new Response(messages.admin.errors.exportListChanged, { status: 409 });
  }

  return xlsxAfterBuild(
    'subscribers',
    { adminId, rows: result.items.length, filters },
    'nexora-subscribers',
    () => buildSubscribersWorkbook(result.items, { query, selected: 0, generatedAt }),
  );
}
