import type { EnquiryDetail, EnquiryRow, EnquiryStatusValue } from '@tourism/contract';
import { messages } from '@tourism/i18n';
import { formatCalendarDate, formatDateTime } from './bookings-view';

/**
 * Mapper hiển thị vùng `/enquiries` (spec P4c §3-F9) — THUẦN, ngoài React nên
 * test được từng nhánh; bảng và trang chi tiết chỉ render VM có sẵn.
 *
 * Ngày giờ mượn `bookings-view` (in UTC; `travelDate` là ngày trần nên đi qua
 * `formatCalendarDate`) — một luật đọc thời gian cho cả back-office.
 */

const t = messages.admin.enquiries;

/**
 * Variant Badge — luật màu là DỮ LIỆU. WON nổi bật (kết cục muốn thấy); LOST
 * viền trơn: nó là một kết cục KINH DOANH bình thường, không phải lỗi hệ
 * thống, nên KHÔNG dùng `destructive` (tông đỏ ở back-office này dành cho
 * "cần người ngay" — outbox FAILED, payment event kẹt). Ba trạng thái đang mở
 * nhạt như nhau: chúng là hàng chờ, khác nhau ở chỗ đã đi tới đâu chứ không
 * ở mức cấp bách.
 */
export function enquiryStatusBadgeVariant(
  status: EnquiryStatusValue,
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'WON':
      return 'default';
    case 'LOST':
      return 'outline';
    default:
      return 'secondary';
  }
}

/** Nhãn trạng thái theo enum contract — `Record` đủ member ở i18n. */
export function enquiryStatusLabel(status: EnquiryStatusValue): string {
  return t.status[status];
}

/** Số khách thành câu đọc được; null khi form bỏ trống (bảng in gạch). */
function groupSizeLabel(groupSize: number | null): string | null {
  return groupSize === null ? null : t.list.groupSize(groupSize);
}

/** Một hàng của bảng `/enquiries`. */
export interface EnquiryRowVM {
  id: string;
  name: string;
  email: string;
  /** Trang chi tiết — cột Name là link, dựng từ id ngay tại VM. */
  href: string;
  /** Đã rơi về "General enquiry" khi lead không gắn tour — bảng không phải rẽ nhánh. */
  tourTitle: string;
  /** null = form bỏ trống; bảng in gạch. */
  travelDate: string | null;
  groupSize: string | null;
  budgetTier: string | null;
  status: EnquiryStatusValue;
  statusLabel: string;
  notesCount: number;
  notesLabel: string;
  created: string;
}

/** Row của contract → hàng bảng đã format sẵn (server component gọi). */
export function toEnquiryRowVM(row: EnquiryRow): EnquiryRowVM {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    href: `/enquiries/${row.id}`,
    tourTitle: row.tourTitle ?? t.list.noTour,
    travelDate: row.travelDate ? formatCalendarDate(row.travelDate) : null,
    groupSize: groupSizeLabel(row.groupSize),
    budgetTier: row.budgetTier,
    status: row.status,
    statusLabel: enquiryStatusLabel(row.status),
    notesCount: row.notesCount,
    notesLabel: t.list.notesCount(row.notesCount),
    created: formatDateTime(row.createdAt),
  };
}

/**
 * Nhãn cho chip "đang lọc theo tour". `tourId` là uuid, và admin chưa có
 * endpoint tra tên tour (quyết định tự chọn F9 — tới P4e), nên tên đọc từ
 * chính hàng đầu tiên của tập đang lọc: mọi hàng trong đó cùng một tour.
 * Tập rỗng (lọc tour + trạng thái không có lead nào) thì không có tên nào để
 * đọc — in chữ thay thế chứ KHÔNG in uuid thô: một chuỗi 36 ký tự trên
 * toolbar không nói gì với ai, còn chip thì vẫn phải hiện để gỡ được.
 */
export function tourFilterLabel(rows: EnquiryRow[], tourId: string | undefined): string | null {
  if (!tourId) return null;
  return rows[0]?.tourTitle ?? t.list.tourFilterUnknown;
}

/** Một dòng `<dt>/<dd>` của thẻ lead — chỉ field CÓ giá trị mới vào danh sách. */
export interface LeadField {
  label: string;
  value: string;
}

/** Một note đã format cho timeline. */
export interface EnquiryNoteVM {
  id: string;
  body: string;
  author: string;
  at: string;
}

/** Một dòng lịch sử trạng thái đã format. */
export interface EnquiryStatusEventVM {
  id: string;
  change: string;
  author: string;
  at: string;
}

export interface EnquiryDetailVM {
  leadFields: LeadField[];
  interests: string[];
  notes: EnquiryNoteVM[];
  statusEvents: EnquiryStatusEventVM[];
}

/**
 * Detail của contract → phần trang chi tiết cần vẽ.
 *
 * Thẻ lead BỎ HẲN dòng của field trống thay vì in một dấu gạch: form công
 * khai có bảy field optional, và một lead chỉ điền email sẽ thành sáu dòng
 * gạch ngang che mất đúng hai dòng có chữ. (Khác trang `/bookings/[code]`:
 * ở đó mọi field đều luôn có nghĩa nên gạch ngang là câu trả lời.)
 *
 * Hai danh sách giữ NGUYÊN thứ tự server trả (cũ trước — `orderBy` của
 * service): mapper không sắp lại, nếu không thì thứ tự có hai nguồn.
 */
export function toEnquiryDetailVM(detail: EnquiryDetail): EnquiryDetailVM {
  const fields: Array<[string, string | null]> = [
    [t.detail.lead.email, detail.email],
    [t.detail.lead.phone, detail.phone],
    [t.detail.lead.nationality, detail.nationality],
    [t.detail.lead.tour, detail.tourTitle],
    [t.detail.lead.travelDate, detail.travelDate ? formatCalendarDate(detail.travelDate) : null],
    [t.detail.lead.groupSize, groupSizeLabel(detail.groupSize)],
    [t.detail.lead.budgetTier, detail.budgetTier],
  ];

  return {
    leadFields: fields
      .filter((entry): entry is [string, string] => entry[1] !== null)
      .map(([label, value]) => ({ label, value })),
    interests: detail.interests,
    notes: detail.notes.map((note) => ({
      id: note.id,
      body: note.body,
      author: t.detail.notes.by(note.authorName),
      at: formatDateTime(note.createdAt),
    })),
    statusEvents: detail.statusEvents.map((event) => ({
      id: event.id,
      change: t.detail.history.change(
        enquiryStatusLabel(event.fromStatus),
        enquiryStatusLabel(event.toStatus),
      ),
      // `adminId` là SetNull: tài khoản bị xoá thì dòng audit vẫn còn, chỉ
      // mất tên — nói thẳng chuyện đó thay vì in "by null".
      author: event.adminName
        ? t.detail.history.by(event.adminName)
        : t.detail.history.unknownAdmin,
      at: formatDateTime(event.createdAt),
    })),
  };
}
