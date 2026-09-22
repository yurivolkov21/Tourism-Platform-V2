import type {
  AdminCategoryCreateInput,
  AdminCategoryMoveInput,
  AdminCategoryRow,
  AdminCategorySetActiveInput,
  AdminCategoryUpdateInput,
} from '@tourism/contract';
import { api, withAdminAuth } from './client';

/**
 * Năm đường của vùng danh mục (spec P4e-2 F14) — bọc mỏng `admin.categories.*`.
 *
 * KHÔNG nuốt lỗi ở bốn lệnh ghi: mã contract phải tới server action nguyên vẹn
 * để nó đổi thành một mã UI. Cùng nếp `api/departures.ts`.
 */

/** Cả bảng, gồm hàng đã tắt, đã sắp theo `order`. */
export async function fetchAdminCategories(cookie: string): Promise<AdminCategoryRow[]> {
  return api.admin.categories.list(undefined, { context: withAdminAuth(cookie) });
}

export async function createAdminCategory(
  cookie: string,
  input: AdminCategoryCreateInput,
): Promise<AdminCategoryRow> {
  return api.admin.categories.create(input, { context: withAdminAuth(cookie) });
}

/** Sửa tên và mô tả. Contract KHÔNG nhận `slug` — nó khoá sau khi tạo. */
export async function updateAdminCategory(
  cookie: string,
  input: AdminCategoryUpdateInput,
): Promise<AdminCategoryRow> {
  return api.admin.categories.update(input, { context: withAdminAuth(cookie) });
}

export async function setAdminCategoryActive(
  cookie: string,
  input: AdminCategorySetActiveInput,
): Promise<AdminCategoryRow> {
  return api.admin.categories.setActive(input, { context: withAdminAuth(cookie) });
}

/** Đổi chỗ với hàng liền kề — trả CẢ danh sách đã sắp lại. */
export async function moveAdminCategory(
  cookie: string,
  input: AdminCategoryMoveInput,
): Promise<AdminCategoryRow[]> {
  return api.admin.categories.move(input, { context: withAdminAuth(cookie) });
}
