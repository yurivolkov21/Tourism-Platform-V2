'use server';

import {
  type AdminPhotoLibrary,
  type AdminPostDeleteInput,
  AdminPostDeleteInputSchema,
  type AdminPostDeleteResult,
  type AdminPostDetail,
  type AdminPostSignCoverUploadInput,
  AdminPostSignCoverUploadInputSchema,
  type AdminPostUpdateInput,
  AdminPostUpdateInputSchema,
  type SignedUploadParams,
} from '@tourism/contract';
import { cookies } from 'next/headers';
import { deleteAdminPost, signAdminPostCoverUpload, updateAdminPost } from '@/lib/api/posts';
import { fetchTourPhotoLibrary } from '@/lib/api/tours';
import { classifyWriteError } from '@/lib/api/write-error';
import type { PhotoLibraryResult } from '@/lib/photo-library';
import {
  classifyDeletePostError,
  classifySignCoverError,
  classifyUpdatePostError,
  type DeletePostResult,
  type SignCoverResult,
  type UpdatePostResult,
} from '@/lib/posts-write';

/**
 * Hành vi GHI của trang sửa bài (spec P4e-4 §4.4) — cùng khuôn
 * `tours/[slug]/actions.ts`: re-parse bằng CHÍNH schema contract (hỏng là `INVALID_INPUT`),
 * `cookies()` gọi ngoài `try`, `try` chỉ ôm đúng lời gọi API. KHÔNG `revalidatePath`: client
 * tự `router.refresh()`; cache WEB do API tự bust sau commit.
 */
export async function updatePostAction(input: AdminPostUpdateInput): Promise<UpdatePostResult> {
  const parsed = AdminPostUpdateInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let detail: AdminPostDetail;
  try {
    detail = await updateAdminPost(cookie, parsed.data);
  } catch (error) {
    return { ok: false, code: classifyUpdatePostError(error) };
  }
  return { ok: true, detail };
}

/**
 * Ký một lượt tải ảnh bìa — bộ tham số không mang api_secret (ADR-0021 §1), chữ ký sống
 * mười phút. publicId vào hàng dọn ngay lúc ký (phía API).
 */
export async function signPostCoverUploadAction(
  input: AdminPostSignCoverUploadInput,
): Promise<SignCoverResult> {
  const parsed = AdminPostSignCoverUploadInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let params: SignedUploadParams;
  try {
    params = await signAdminPostCoverUpload(cookie, parsed.data);
  } catch (error) {
    return { ok: false, code: classifySignCoverError(error) };
  }
  return { ok: true, params };
}

/**
 * Kho ảnh địa danh cho hộp chọn ảnh bìa — CÙNG endpoint thư viện của ảnh tour (spec §3.1).
 * Thủ tục không khai mã lỗi, nên chỉ còn lỗi vận chuyển.
 */
export async function loadPostCoverLibraryAction(): Promise<PhotoLibraryResult> {
  const cookie = (await cookies()).toString();
  let library: AdminPhotoLibrary;
  try {
    library = await fetchTourPhotoLibrary(cookie);
  } catch (error) {
    return { ok: false, code: classifyWriteError(error, new Set<never>()) };
  }
  return { ok: true, library };
}

/** Xoá bài — mang phiên bản form đang cầm (ADR-0051 §2): người khác vừa lưu thì `STALE_POST`. */
export async function deletePostAction(input: AdminPostDeleteInput): Promise<DeletePostResult> {
  const parsed = AdminPostDeleteInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let deleted: AdminPostDeleteResult;
  try {
    deleted = await deleteAdminPost(cookie, parsed.data);
  } catch (error) {
    return { ok: false, code: classifyDeletePostError(error) };
  }
  return { ok: true, deleted };
}
