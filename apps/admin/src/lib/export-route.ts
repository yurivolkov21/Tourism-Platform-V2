import { messages } from '@tourism/i18n';
import { decideAdminAccess } from '@/lib/admin-gate';
import { lookupServerSession, type SessionUser } from '@/lib/api/session';
import { csvAttachmentHeaders, csvDocument, csvFilename, isoDay } from '@/lib/csv';

/**
 * Phần CHUNG của mọi route export CSV — nâng lên ở vòng vá review F10 khi
 * `/subscribers/export` là bản chép thứ BA của khối gác quyền + audit +
 * headers mà `/bookings/export` và `/reports/export` đang giữ riêng (reports
 * đã trôi: không có dòng audit nào). Đây là khối AN NINH: route handler
 * KHÔNG chạy qua `(admin)/layout.tsx`, nên quên gác ở route thứ tư là mọi
 * user đăng nhập tải được cả danh sách email. Một nơi khai, mọi route gọi.
 *
 * Ba việc, ba hàm — vùng chỉ còn parse query, fetch và mapper CSV.
 */

/** Kết quả gác quyền: có phiên admin, hoặc một `Response` để trả ngay. */
export type ExportGate = { ok: true; session: SessionUser } | { ok: false; response: Response };

/**
 * Gác quyền TẠI route, đúng thứ tự đã chốt ở vòng vá review F6: check phiên
 * đi QUA API nên API sập phải nói thật là API sập (502) TRƯỚC khi bảo "chưa
 * đăng nhập" (401) hay "không đủ quyền" (403). Trả text chứ không redirect:
 * đây là một cú tải file, redirect sang `/login` chỉ làm trình duyệt lưu một
 * file HTML tên .csv.
 */
export async function guardExportAccess(path: string): Promise<ExportGate> {
  const lookup = await lookupServerSession();
  if (lookup.kind === 'unreachable') {
    return { ok: false, response: exportFailedResponse() };
  }
  const session = lookup.kind === 'ok' ? lookup.user : null;
  const decision = decideAdminAccess(session ? { role: session.role } : null, path);
  if (decision.kind === 'login' || !session) {
    return {
      ok: false,
      response: new Response(messages.admin.errors.write.UNAUTHORIZED, { status: 401 }),
    };
  }
  if (decision.kind === 'deny') {
    return {
      ok: false,
      response: new Response(messages.admin.errors.write.FORBIDDEN, { status: 403 }),
    };
  }
  return { ok: true, session };
}

/** 502 "upstream hỏng" — API sập/timeout giữa vòng gom, hoặc check phiên trượt. */
export function exportFailedResponse(): Response {
  return new Response(messages.admin.errors.exportFailed, { status: 502 });
}

/**
 * Vết cho một cú xuất PII hàng loạt: mọi hành vi GHI của admin đều quy được
 * về người, còn cú ĐỌC này mang email/tên của cả tập lọc — "ai tải, lúc nào,
 * bộ lọc gì, KẾT CỤC gì" phải trả lời được khi điều tra. Log CÓ CẤU TRÚC và
 * KHÔNG chép PII: caller đưa `search` vào dạng có/không, vì chính nó thường
 * là một địa chỉ email. `outcome` khác `ok` cũng ghi (vòng vá review F10 —
 * bản đầu chỉ log khi thành công, nên một chuỗi lần thử bị 413/502 không để
 * lại vết nào).
 */
export function logExportAudit(
  area: string,
  entry: {
    adminId: string;
    outcome: 'ok' | 'too-large' | 'changed' | 'stale' | 'failed';
    rows?: number;
    mode?: string;
    filters: Record<string, string | number | boolean | null>;
  },
): void {
  console.info(`[admin] ${area} export`, JSON.stringify(entry));
}

/** Response CSV đính kèm — tên file `<prefix>-<ngày xuất>.csv`. */
export function csvExportResponse(prefix: string, rows: readonly (readonly string[])[]): Response {
  return new Response(csvDocument(rows), {
    headers: csvAttachmentHeaders(csvFilename(prefix, isoDay(new Date()))),
  });
}
