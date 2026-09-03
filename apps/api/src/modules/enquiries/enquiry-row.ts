import type {
  EnquiryDetail,
  EnquiryNoteItem,
  EnquiryRow,
  EnquiryStatusEventItem,
} from '@tourism/contract';
import type { EnquiryStatus } from '../../generated/prisma/enums.js';

/**
 * Row Prisma `enquiries` → `EnquiryRow` / `EnquiryDetail` của contract (spec
 * P4c §3-F9). THUẦN — unit test không cần DB.
 *
 * Bốn luật đáng đọc kỹ:
 *
 * 1. **Tour là một CẶP** `tourTitle`/`tourSlug`: cả hai cùng có hoặc cùng
 *    null. Enquiry có thể là câu hỏi chung (`tourId` null) hoặc trỏ tới tour
 *    đã bị xoá (`onDelete: SetNull`) — hai đường đều rơi về cùng một câu trả
 *    lời "không gắn tour nào", và UI chỉ phải xử một nhánh.
 * 2. **`travelDate` là cột `@db.Date`**, không phải datetime: Prisma đọc ra
 *    `Date` lúc 00:00 UTC, nên cắt 10 ký tự đầu của ISO là ĐÚNG ngày khách
 *    gõ. Đi qua `getDate()`/`toLocaleDateString` sẽ lùi một ngày trên mọi
 *    máy ở múi giờ âm — và server capstone chạy UTC còn máy dev thì không.
 * 3. **`adminName` của audit trail đọc qua JOIN** (`name` → `email` → null),
 *    KHÁC `authorName` của note (snapshot trong cột). Lý do ở JSDoc model
 *    `EnquiryStatusEvent`: tên trong note là một phần NỘI DUNG của thread
 *    người đọc, còn tên trong audit là danh tính một tài khoản. Fallback
 *    email để một admin chưa đặt tên vẫn quy được về người; null chỉ còn khi
 *    tài khoản đã bị xoá.
 * 4. Danh sách VÀO SAO RA VẬY — thứ tự (cũ trước) là việc của `orderBy` bên
 *    service, mapper không sắp lại.
 */

/** Phần row mà bảng cần — service `select` đúng chừng này (không kéo message). */
export interface EnquiryListRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  tour: { title: string; slug: string } | null;
  travelDate: Date | null;
  groupSize: number | null;
  budgetTier: string | null;
  status: EnquiryStatus;
  createdAt: Date;
  updatedAt: Date;
  _count: { notes: number };
}

/** Thêm phần chỉ trang chi tiết cần (message nguyên văn + hai danh sách). */
export interface EnquiryDetailRow extends EnquiryListRow {
  message: string;
  nationality: string | null;
  interests: string[];
  notes: Array<{ id: string; authorName: string; body: string; createdAt: Date }>;
  statusEvents: Array<{
    id: string;
    fromStatus: EnquiryStatus;
    toStatus: EnquiryStatus;
    admin: { name: string | null; email: string } | null;
    createdAt: Date;
  }>;
}

export function toEnquiryRow(row: EnquiryListRow): EnquiryRow {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
    tourTitle: row.tour?.title ?? null,
    tourSlug: row.tour?.slug ?? null,
    // Cột DATE: 10 ký tự đầu của ISO UTC — xem luật 2 ở JSDoc trên.
    travelDate: row.travelDate ? row.travelDate.toISOString().slice(0, 10) : null,
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
    // name → email → null (luật 3 ở JSDoc trên).
    adminName: event.admin?.name ?? event.admin?.email ?? null,
    createdAt: event.createdAt.toISOString(),
  };
}
