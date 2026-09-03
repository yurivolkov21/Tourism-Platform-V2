import { isDefinedError, safe } from '@orpc/client';
import type {
  AdminEnquiryAddNoteInput,
  AdminEnquiryAddNoteResult,
  AdminEnquiryByIdInput,
  AdminEnquirySetStatusInput,
  AdminEnquirySetStatusResult,
  EnquiryDetail,
  EnquiryRow,
  Paged,
} from '@tourism/contract';
import type { EnquiriesQuery } from '@/lib/enquiries-query';
import { api, withAdminAuth } from './client';

/**
 * Bốn đường của vùng enquiries (spec P4c §3-F9) — bọc mỏng `admin.enquiries.*`.
 * KHÔNG nuốt lỗi ở đây: `NOT_FOUND` phải tới nơi gọi nguyên vẹn (trang chi
 * tiết đổi nó thành `notFound()`, server action đổi nó thành một mã UI).
 */

/**
 * Một trang lead (mới nhất trước — server đã orderBy `createdAt desc`), KHÔNG
 * mang message. Input là kết quả `parseEnquiriesSearchParams`, tức đã clamp.
 */
export async function fetchAdminEnquiries(
  cookie: string,
  query: EnquiriesQuery,
): Promise<Paged<EnquiryRow>> {
  return api.admin.enquiries.list(query, { context: withAdminAuth(cookie) });
}

/**
 * Một lead đầy đủ: message nguyên văn + thread note + lịch sử trạng thái.
 *
 * `null` = KHÔNG có lead này, để trang gọi `notFound()`; MỌI lỗi khác ném lại
 * cho error boundary (cùng khuôn `fetchAdminBookingByCode`). Phân biệt bằng
 * con dấu `isDefinedError` của oRPC chứ không phải `catch` trần: một 500 hay
 * một phiên hết hạn mà hiện ra trang "không tìm thấy" là bảo admin đi tìm
 * một lead vẫn còn nguyên ở đó.
 */
export async function fetchAdminEnquiry(
  cookie: string,
  input: AdminEnquiryByIdInput,
): Promise<EnquiryDetail | null> {
  const [error, data] = await safe(
    api.admin.enquiries.byId(input, { context: withAdminAuth(cookie) }),
  );
  if (error) {
    if (isDefinedError(error) && error.code === 'NOT_FOUND') return null;
    throw error;
  }
  return data;
}

/** Đổi trạng thái — server chạy update + audit trong CÙNG một transaction; `changed: false` là no-op. */
export async function setAdminEnquiryStatus(
  cookie: string,
  input: AdminEnquirySetStatusInput,
): Promise<AdminEnquirySetStatusResult> {
  return api.admin.enquiries.setStatus(input, { context: withAdminAuth(cookie) });
}

/** Nối một note vào thread append-only — tác giả lấy từ phiên ở phía API. */
export async function addAdminEnquiryNote(
  cookie: string,
  input: AdminEnquiryAddNoteInput,
): Promise<AdminEnquiryAddNoteResult> {
  return api.admin.enquiries.addNote(input, { context: withAdminAuth(cookie) });
}
