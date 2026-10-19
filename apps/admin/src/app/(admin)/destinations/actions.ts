'use server';

import {
  type AdminDestinationCreateInput,
  AdminDestinationCreateInputSchema,
  type AdminDestinationDeleteInput,
  AdminDestinationDeleteInputSchema,
  type AdminDestinationDeleteResult,
  type AdminDestinationPhotos,
  type AdminDestinationRow,
  type AdminDestinationSetActiveInput,
  AdminDestinationSetActiveInputSchema,
  type AdminDestinationSetPhotosInput,
  AdminDestinationSetPhotosInputSchema,
  type AdminDestinationSignPhotoUploadsInput,
  AdminDestinationSignPhotoUploadsInputSchema,
  type AdminDestinationUpdateInput,
  AdminDestinationUpdateInputSchema,
  type SignedUploadParams,
} from '@tourism/contract';
import { cookies } from 'next/headers';
import {
  createAdminDestination,
  deleteAdminDestination,
  setAdminDestinationActive,
  setAdminDestinationPhotos,
  signAdminDestinationPhotoUploads,
  updateAdminDestination,
} from '@/lib/api/destinations';
import {
  classifySetDestinationPhotosError,
  classifySignDestinationUploadsError,
  type SetDestinationPhotosResult,
  type SignDestinationUploadsCode,
} from '@/lib/destination-photos';
import {
  type CreateContractCode,
  classifyCreateError,
  classifyDeleteError,
  classifySetActiveError,
  classifyUpdateError,
  type DestinationDeleteResult,
  type DestinationWriteResult,
  type SetActiveContractCode,
  type UpdateContractCode,
} from '@/lib/destinations-write';
import type { SignPhotoUploadsResult } from '@/lib/tour-photos';

/**
 * Hành vi ghi của vùng điểm đến (spec P4e-2 F15, lệnh xoá theo ADR-0053) —
 * cùng khuôn đã chốt ở `categories/actions.ts`:
 *
 * - SERVER ACTION vì client oRPC của admin là đường server-only (đọc cookie
 *   phiên qua `next/headers`), được gọi từ một dialog client.
 * - Quyền KHÔNG kiểm ở đây: gác ở `AuthGuard` + `@Roles(ADMIN)` của API.
 * - Input re-parse bằng CHÍNH schema contract TRƯỚC khi đi: input hỏng ra mã
 *   `INVALID_INPUT` chứ không phải một câu GENERIC mập mờ. Đây cũng là chốt
 *   cuối chặn `slug` lọt vào lệnh sửa, và chặn một vùng ngoài ba tên.
 * - `cookies()` gọi NGOÀI `try`, và `try` chỉ ôm ĐÚNG lời gọi API.
 * - KHÔNG `revalidatePath` ở đây: trang là server component ĐỘNG. Cache của
 *   WEB thì do API tự bust sau lệnh ghi (ADR-0016 §3).
 */

export async function createDestinationAction(
  input: AdminDestinationCreateInput,
): Promise<DestinationWriteResult<CreateContractCode>> {
  const parsed = AdminDestinationCreateInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let row: AdminDestinationRow;
  try {
    row = await createAdminDestination(cookie, parsed.data);
  } catch (error) {
    // `ORPCError` không sống sót qua ranh giới action — phân loại tại đây.
    return { ok: false, code: classifyCreateError(error) };
  }
  return { ok: true, row };
}

export async function updateDestinationAction(
  input: AdminDestinationUpdateInput,
): Promise<DestinationWriteResult<UpdateContractCode>> {
  const parsed = AdminDestinationUpdateInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let row: AdminDestinationRow;
  try {
    row = await updateAdminDestination(cookie, parsed.data);
  } catch (error) {
    return { ok: false, code: classifyUpdateError(error) };
  }
  return { ok: true, row };
}

export async function setDestinationActiveAction(
  input: AdminDestinationSetActiveInput,
): Promise<DestinationWriteResult<SetActiveContractCode>> {
  const parsed = AdminDestinationSetActiveInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let row: AdminDestinationRow;
  try {
    row = await setAdminDestinationActive(cookie, parsed.data);
  } catch (error) {
    return { ok: false, code: classifySetActiveError(error) };
  }
  // Trạng thái đọc từ RESPONSE, không từ input đã gửi.
  return { ok: true, row };
}

export async function deleteDestinationAction(
  input: AdminDestinationDeleteInput,
): Promise<DestinationDeleteResult> {
  const parsed = AdminDestinationDeleteInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let deleted: AdminDestinationDeleteResult;
  try {
    deleted = await deleteAdminDestination(cookie, parsed.data);
  } catch (error) {
    // `ORPCError` không sống sót qua ranh giới action — phân loại tại đây.
    return { ok: false, code: classifyDeleteError(error) };
  }
  return { ok: true, deleted };
}

/** Thay trọn danh sách ảnh của một điểm đến (ADR-0060 §8) — trang `/destinations/<slug>/photos`. */
export async function setDestinationPhotosAction(
  input: AdminDestinationSetPhotosInput,
): Promise<SetDestinationPhotosResult> {
  const parsed = AdminDestinationSetPhotosInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let detail: AdminDestinationPhotos;
  try {
    detail = await setAdminDestinationPhotos(cookie, parsed.data);
  } catch (error) {
    return { ok: false, code: classifySetDestinationPhotosError(error) };
  }
  return { ok: true, detail };
}

/**
 * Ký một lô upload vào thư mục của điểm đến — trả bộ tham số cho TRÌNH DUYỆT POST thẳng lên
 * Cloudinary, như ảnh tour. Bộ tham số không mang api_secret (ADR-0021 §1).
 */
export async function signDestinationPhotoUploadsAction(
  input: AdminDestinationSignPhotoUploadsInput,
): Promise<SignPhotoUploadsResult<SignDestinationUploadsCode>> {
  const parsed = AdminDestinationSignPhotoUploadsInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let params: SignedUploadParams[];
  try {
    params = await signAdminDestinationPhotoUploads(cookie, parsed.data);
  } catch (error) {
    return { ok: false, code: classifySignDestinationUploadsError(error) };
  }
  return { ok: true, params };
}
