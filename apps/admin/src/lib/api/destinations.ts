import type {
  AdminDestinationCreateInput,
  AdminDestinationRow,
  AdminDestinationSetActiveInput,
  AdminDestinationUpdateInput,
} from '@tourism/contract';
import { api, withAdminAuth } from './client';

/**
 * Bốn đường của vùng điểm đến (spec P4e-2 F15) — bọc mỏng `admin.destinations.*`.
 *
 * KHÔNG nuốt lỗi ở ba lệnh ghi: mã contract phải tới server action nguyên vẹn
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
