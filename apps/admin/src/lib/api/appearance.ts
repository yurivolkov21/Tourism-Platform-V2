import type {
  AdminAppearanceSetSlotInput,
  AdminAppearanceSignUploadInput,
  AdminSiteSlot,
  SignedUploadParams,
} from '@tourism/contract';
import { api, withAdminAuth } from './client';

/**
 * Các đường của Appearance — bọc mỏng `admin.appearance.*` (ADR-0059). KHÔNG nuốt lỗi ở đường
 * ghi: mã contract phải tới server action nguyên vẹn để đổi thành mã UI.
 *
 * KHÔNG cache: `router.refresh()` sau mỗi lần lưu phải kéo về đúng ảnh web đang vẽ.
 */

/** 47 khe theo thứ tự danh mục — kể cả khe chưa có dòng (`image: null`). */
export async function fetchAdminAppearance(cookie: string): Promise<AdminSiteSlot[]> {
  return api.admin.appearance.list(undefined, { context: withAdminAuth(cookie) });
}

/** Ký một lượt tải ảnh vào thư mục của khe — bộ tham số cho TRÌNH DUYỆT POST thẳng lên Cloudinary. */
export async function signAdminSlotUpload(
  cookie: string,
  input: AdminAppearanceSignUploadInput,
): Promise<SignedUploadParams> {
  return api.admin.appearance.signUpload(input, { context: withAdminAuth(cookie) });
}

export async function setAdminSiteSlot(
  cookie: string,
  input: AdminAppearanceSetSlotInput,
): Promise<AdminSiteSlot> {
  return api.admin.appearance.setSlot(input, { context: withAdminAuth(cookie) });
}
