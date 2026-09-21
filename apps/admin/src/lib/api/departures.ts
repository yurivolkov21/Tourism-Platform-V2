import { isDefinedError, safe } from '@orpc/client';
import type {
  AdminDepartureCreateInput,
  AdminDepartureRow,
  AdminDepartureSetStatusInput,
  AdminDeparturesListResult,
  AdminDepartureUpdateInput,
} from '@tourism/contract';
import type { DeparturesQuery } from '@/lib/departures-query';
import { api, withAdminAuth } from './client';

/**
 * Bốn đường của vùng chuyến (spec P4e-1 F12) — bọc mỏng `admin.departures.*`.
 * KHÔNG nuốt lỗi ở ba lệnh ghi: mã contract phải tới server action nguyên vẹn
 * để nó đổi thành một mã UI.
 */

/**
 * Một trang chuyến CỘNG chính tour đang mở.
 *
 * `null` = KHÔNG có tour này, để trang gọi `notFound()`; MỌI lỗi khác ném lại
 * cho error boundary (cùng khuôn `fetchAdminEnquiry`). Phân biệt bằng con dấu
 * `isDefinedError` của oRPC chứ không `catch` trần — một 500 hay một phiên
 * hết hạn mà hiện ra trang "không tìm thấy" là bảo admin đi tìm một tour vẫn
 * còn nguyên ở đó.
 */
export async function fetchAdminDepartures(
  cookie: string,
  query: DeparturesQuery,
): Promise<AdminDeparturesListResult | null> {
  const [error, data] = await safe(
    api.admin.departures.list(query, { context: withAdminAuth(cookie) }),
  );
  if (error) {
    if (isDefinedError(error) && error.code === 'NOT_FOUND') return null;
    throw error;
  }
  return data;
}

/** Thêm một chuyến vào lịch của tour. */
export async function createAdminDeparture(
  cookie: string,
  input: AdminDepartureCreateInput,
): Promise<AdminDepartureRow> {
  return api.admin.departures.create(input, { context: withAdminAuth(cookie) });
}

/** Sửa ngày · ghế · giá — server khoá hàng chuyến rồi mới phán. */
export async function updateAdminDeparture(
  cookie: string,
  input: AdminDepartureUpdateInput,
): Promise<AdminDepartureRow> {
  return api.admin.departures.update(input, { context: withAdminAuth(cookie) });
}

/** Đóng hoặc mở lại. Contract KHÔNG nhận `CANCELLED` — huỷ là đường riêng. */
export async function setAdminDepartureStatus(
  cookie: string,
  input: AdminDepartureSetStatusInput,
): Promise<AdminDepartureRow> {
  return api.admin.departures.setStatus(input, { context: withAdminAuth(cookie) });
}
