import type {
  AdminDestinationCreateInput,
  AdminDestinationDeleteInput,
  AdminDestinationDeleteResult,
  AdminDestinationRow,
  AdminDestinationSetActiveInput,
  AdminDestinationUpdateInput,
} from '@tourism/contract';
import { api, withAdminAuth } from './client';

/**
 * Năm đường của vùng điểm đến (spec P4e-2 F15, lệnh xoá theo ADR-0053) — bọc mỏng
 * `admin.destinations.*`.
 *
 * KHÔNG nuốt lỗi ở bốn lệnh ghi: mã contract phải tới server action nguyên vẹn
 * để nó đổi thành một mã UI. Cùng nếp `api/categories.ts`.
 */

/** Cả bảng, gồm hàng đã ẩn, sắp theo tên. */
export async function fetchAdminDestinations(cookie: string): Promise<AdminDestinationRow[]> {
  return api.admin.destinations.list(undefined, { context: withAdminAuth(cookie) });
}

export async function createAdminDestination(
  cookie: string,
  input: AdminDestinationCreateInput,
): Promise<AdminDestinationRow> {
  return api.admin.destinations.create(input, { context: withAdminAuth(cookie) });
}

/** Sửa tên, quốc gia, vùng, mô tả. Contract KHÔNG nhận `slug` — nó khoá sau khi tạo. */
export async function updateAdminDestination(
  cookie: string,
  input: AdminDestinationUpdateInput,
): Promise<AdminDestinationRow> {
  return api.admin.destinations.update(input, { context: withAdminAuth(cookie) });
}

export async function setAdminDestinationActive(
  cookie: string,
  input: AdminDestinationSetActiveInput,
): Promise<AdminDestinationRow> {
  return api.admin.destinations.setActive(input, { context: withAdminAuth(cookie) });
}

/** Xoá một điểm đến chưa tour nào dùng (ADR-0053) — trả slug của hàng vừa xoá. */
export async function deleteAdminDestination(
  cookie: string,
  input: AdminDestinationDeleteInput,
): Promise<AdminDestinationDeleteResult> {
  return api.admin.destinations.delete(input, { context: withAdminAuth(cookie) });
}
