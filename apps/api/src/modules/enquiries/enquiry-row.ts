import type {
  EnquiryDetail,
  EnquiryNoteItem,
  EnquiryRow,
  EnquiryStatusEventItem,
} from '@tourism/contract';
import type { Prisma } from '../../generated/prisma/client.js';
import { calendarDate } from '../../lib/calendar-date.js';

/**
 * Row Prisma `enquiries` → `EnquiryRow` / `EnquiryDetail` của contract (spec
 * P4c §3-F9). THUẦN — unit test không cần DB.
 *
 * Hai `select` sống Ở ĐÂY cạnh mapper đọc chúng, và kiểu row derive bằng
 * `Prisma.EnquiryGetPayload` từ chính chúng (vòng vá review F9 — bản đầu
 * chép tay hai interface mirror hai object select ở file service: bỏ một cột
 * khỏi select mà quên interface thì TypeScript im lặng, `undefined` lọt vào
 * contract lúc chạy). Service chỉ `import`.
 *
 * Bốn luật đáng đọc kỹ:
 *
 * 1. **Tour chỉ có TITLE** ở cả list lẫn detail: null khi enquiry là câu hỏi
 *    chung (`tourId` null) hoặc tour đã bị xoá (`onDelete: SetNull`) — hai
 *    đường cùng một câu trả lời "không gắn tour nào". `slug` không đi qua
 *    dây: chưa có link nào sang web (vòng vá review F9).
 * 2. **`travelDate` là cột `@db.Date`** → `calendarDate` dùng chung của API
 *    (cắt theo UTC, không đi qua `getDate()` — xem JSDoc ở `lib/calendar-date`).
 * 3. **`adminName` của audit trail đọc qua JOIN** (`name` → `email` → null),
 *    KHÁC `authorName` của note (snapshot trong cột). Tên trong note là một
 *    phần NỘI DUNG của thread người đọc, còn tên trong audit là danh tính một
 *    tài khoản; `users` không bao giờ hard-delete (FK Restrict) nên JOIN
 *    không mất. Tên RỖNG coi như vắng (`trim() ||`, vòng vá review F9):
 *    better-auth không cấm `name = ''`, và `??` thì cho nó lọt.
 * 4. Danh sách VÀO SAO RA VẬY — thứ tự (cũ trước) là việc của `orderBy`,
 *    mapper không sắp lại.
 */

/**
 * Cột của một hàng bảng. KHÔNG kéo `message` (tới 2000 ký tự × 20 hàng chỉ để
 * hiện bốn dòng đầu), `interests`, lẫn `phone` (PII không có cột nào in) —
 * trang chi tiết đọc. `_count.notes` là cột "Notes": dấu hiệu lead đã có
 * người sờ tới.
 */
export const LIST_SELECT = {
  id: true,
  name: true,
  email: true,
  tour: { select: { title: true } },
  travelDate: true,
  groupSize: true,
  budgetTier: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { notes: true } },
} satisfies Prisma.EnquirySelect;

/**
 * Thêm phần chỉ trang chi tiết cần. Cả hai danh sách sắp CŨ TRƯỚC
 * (`createdAt asc`, `id` phụ cho hai row cùng mili-giây): thread note đọc như
 * một cuộc trò chuyện, còn lịch sử trạng thái đọc như một dòng thời gian —
 * đảo lại là bắt người đọc dựng ngược câu chuyện trong đầu.
 */
export const DETAIL_SELECT = {
  ...LIST_SELECT,
  phone: true,
  message: true,
  nationality: true,
  interests: true,
  notes: {
    select: { id: true, authorName: true, body: true, createdAt: true },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  },
  statusEvents: {
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      createdAt: true,
      // `adminName` đọc qua JOIN chứ không snapshot — luật 3 ở trên.
      admin: { select: { name: true, email: true } },
    },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
  },
} satisfies Prisma.EnquirySelect;

export type EnquiryListRow = Prisma.EnquiryGetPayload<{ select: typeof LIST_SELECT }>;
export type EnquiryDetailRow = Prisma.EnquiryGetPayload<{ select: typeof DETAIL_SELECT }>;

/**
 * Tên hiển thị của một tài khoản: `name` có chữ thì lấy, còn lại là email.
 * Chuỗi rỗng/toàn dấu cách là VẮNG — dùng chung cho snapshot `authorName`
 * của note (service) và `adminName` của audit (mapper), một luật.
 */
export function accountDisplayName(account: { name: string | null; email: string }): string {
  return account.name?.trim() || account.email;
}

export function toEnquiryRow(row: EnquiryListRow): EnquiryRow {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    tourTitle: row.tour?.title ?? null,
    travelDate: row.travelDate ? calendarDate(row.travelDate) : null,
    groupSize: row.groupSize,
    budgetTier: row.budgetTier,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    notesCount: row._count.notes,
  };
}

export function toEnquiryDetail(row: EnquiryDetailRow): EnquiryDetail {
  return {
    ...toEnquiryRow(row),
    phone: row.phone,
    message: row.message,
    nationality: row.nationality,
    interests: row.interests,
    notes: row.notes.map(toEnquiryNote),
    statusEvents: row.statusEvents.map(toEnquiryStatusEvent),
  };
}

function toEnquiryNote(note: EnquiryDetailRow['notes'][number]): EnquiryNoteItem {
  return {
    id: note.id,
    authorName: note.authorName,
    body: note.body,
    createdAt: note.createdAt.toISOString(),
  };
}

function toEnquiryStatusEvent(
  event: EnquiryDetailRow['statusEvents'][number],
): EnquiryStatusEventItem {
  return {
    id: event.id,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    adminName: event.admin ? accountDisplayName(event.admin) : null,
    createdAt: event.createdAt.toISOString(),
  };
}
