import { isDefinedError, safe } from '@orpc/client';
import {
  type AdminDestinationCreateInput,
  type AdminDestinationDeleteInput,
  type AdminDestinationDeleteResult,
  type AdminDestinationPhotos,
  AdminDestinationPhotosInputSchema,
  type AdminDestinationRow,
  type AdminDestinationSetActiveInput,
  type AdminDestinationSetPhotosInput,
  type AdminDestinationSignPhotoUploadsInput,
  type AdminDestinationUpdateInput,
  type SignedUploadParams,
} from '@tourism/contract';
import { api, withAdminAuth } from './client';

/**
 * Các đường của vùng điểm đến (spec P4e-2 F15, lệnh xoá theo ADR-0053, ba đường ảnh theo
 * ADR-0060 §8) — bọc mỏng `admin.destinations.*`.
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

/**
 * Trang Photos của một điểm đến (ADR-0060 §8). `null` khi slug sai hình hay điểm đến không có —
 * trang gọi `notFound()`, như `fetchAdminTour`. Lỗi khác NÉM: boundary của trang lo.
 */
export async function fetchAdminDestinationPhotos(
  cookie: string,
  slug: string,
): Promise<AdminDestinationPhotos | null> {
  if (!AdminDestinationPhotosInputSchema.safeParse({ slug }).success) return null;
  const [error, data] = await safe(
    api.admin.destinations.photos({ slug }, { context: withAdminAuth(cookie) }),
  );
  if (error) {
    if (isDefinedError(error) && error.code === 'NOT_FOUND') return null;
    throw error;
  }
  return data;
}

/** Thay trọn danh sách ảnh của điểm đến. */
export async function setAdminDestinationPhotos(
  cookie: string,
  input: AdminDestinationSetPhotosInput,
): Promise<AdminDestinationPhotos> {
  return api.admin.destinations.setPhotos(input, { context: withAdminAuth(cookie) });
}

/** Ký một lô upload thẳng lên Cloudinary vào thư mục của điểm đến. */
export async function signAdminDestinationPhotoUploads(
  cookie: string,
  input: AdminDestinationSignPhotoUploadsInput,
): Promise<SignedUploadParams[]> {
  return api.admin.destinations.signPhotoUploads(input, { context: withAdminAuth(cookie) });
}
