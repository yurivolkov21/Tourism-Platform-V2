'use server';

import {
  type AdminPhotoLibrary,
  type AdminTourCostsInput,
  AdminTourCostsInputSchema,
  type AdminTourDeleteInput,
  AdminTourDeleteInputSchema,
  type AdminTourDeleteResult,
  type AdminTourDetail,
  type AdminTourDetailsInput,
  AdminTourDetailsInputSchema,
  type AdminTourFaqsPoliciesInput,
  AdminTourFaqsPoliciesInputSchema,
  type AdminTourItineraryInput,
  AdminTourItineraryInputSchema,
  type AdminTourPhotosInput,
  AdminTourPhotosInputSchema,
  type AdminTourSignPhotoUploadsInput,
  AdminTourSignPhotoUploadsInputSchema,
  type SignedUploadParams,
} from '@tourism/contract';
import { cookies } from 'next/headers';
import {
  deleteAdminTour,
  fetchTourPhotoLibrary,
  setAdminTourCosts,
  setAdminTourFaqsPolicies,
  setAdminTourItinerary,
  setAdminTourPhotos,
  signAdminTourPhotoUploads,
  updateAdminTourDetails,
} from '@/lib/api/tours';
import { classifyWriteError } from '@/lib/api/write-error';
import type { PhotoLibraryResult } from '@/lib/photo-library';
import {
  type ContentContractCode,
  type CostsContractCode,
  classifyContentError,
  classifyCostsError,
  classifyDeleteTourError,
  classifyDetailsError,
  classifyItineraryError,
  type DeleteTourResult,
  type DetailsContractCode,
  type EditorWriteResult,
  type ItineraryContractCode,
} from '@/lib/tour-editor-write';
import {
  classifyPhotosError,
  classifySignUploadsError,
  type PhotosContractCode,
  type SignPhotoUploadsResult,
} from '@/lib/tour-photos';

/**
 * Hành vi GHI của khu làm việc tour (spec F17) — cùng khuôn `destinations/actions.ts`:
 *
 * - SERVER ACTION vì client oRPC của admin là đường server-only (đọc cookie
 *   phiên qua `next/headers`), được gọi từ form client của từng tab.
 * - Quyền KHÔNG kiểm ở đây: gác ở `AuthGuard` + `@Roles(ADMIN)` của API.
 * - Input re-parse bằng CHÍNH schema contract: hỏng thì `INVALID_INPUT`.
 * - `cookies()` gọi NGOÀI `try`, và `try` chỉ ôm ĐÚNG lời gọi API.
 * - KHÔNG `revalidatePath`: trang là server component động, client tự
 *   `router.refresh()`; cache WEB do API tự bust sau commit.
 */
export async function updateTourDetailsAction(
  input: AdminTourDetailsInput,
): Promise<EditorWriteResult<DetailsContractCode>> {
  const parsed = AdminTourDetailsInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let detail: AdminTourDetail;
  try {
    detail = await updateAdminTourDetails(cookie, parsed.data);
  } catch (error) {
    // `ORPCError` không sống sót qua ranh giới action — phân loại tại đây.
    return { ok: false, code: classifyDetailsError(error) };
  }
  return { ok: true, detail };
}

export async function setTourItineraryAction(
  input: AdminTourItineraryInput,
): Promise<EditorWriteResult<ItineraryContractCode>> {
  const parsed = AdminTourItineraryInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let detail: AdminTourDetail;
  try {
    detail = await setAdminTourItinerary(cookie, parsed.data);
  } catch (error) {
    return { ok: false, code: classifyItineraryError(error) };
  }
  return { ok: true, detail };
}

export async function setTourContentAction(
  input: AdminTourFaqsPoliciesInput,
): Promise<EditorWriteResult<ContentContractCode>> {
  const parsed = AdminTourFaqsPoliciesInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let detail: AdminTourDetail;
  try {
    detail = await setAdminTourFaqsPolicies(cookie, parsed.data);
  } catch (error) {
    return { ok: false, code: classifyContentError(error) };
  }
  return { ok: true, detail };
}

export async function setTourCostsAction(
  input: AdminTourCostsInput,
): Promise<EditorWriteResult<CostsContractCode>> {
  const parsed = AdminTourCostsInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let detail: AdminTourDetail;
  try {
    detail = await setAdminTourCosts(cookie, parsed.data);
  } catch (error) {
    return { ok: false, code: classifyCostsError(error) };
  }
  return { ok: true, detail };
}

export async function deleteTourAction(input: AdminTourDeleteInput): Promise<DeleteTourResult> {
  const parsed = AdminTourDeleteInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let deleted: AdminTourDeleteResult;
  try {
    deleted = await deleteAdminTour(cookie, parsed.data);
  } catch (error) {
    return { ok: false, code: classifyDeleteTourError(error) };
  }
  return { ok: true, deleted };
}

export async function setTourPhotosAction(
  input: AdminTourPhotosInput,
): Promise<EditorWriteResult<PhotosContractCode>> {
  const parsed = AdminTourPhotosInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let detail: AdminTourDetail;
  try {
    detail = await setAdminTourPhotos(cookie, parsed.data);
  } catch (error) {
    return { ok: false, code: classifyPhotosError(error) };
  }
  return { ok: true, detail };
}

/**
 * Ký một lô upload — trả bộ tham số cho TRÌNH DUYỆT POST thẳng lên Cloudinary.
 * Bộ tham số không mang api_secret (ADR-0021 §1); chữ ký sống mười phút.
 */
export async function signTourPhotoUploadsAction(
  input: AdminTourSignPhotoUploadsInput,
): Promise<SignPhotoUploadsResult> {
  const parsed = AdminTourSignPhotoUploadsInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let params: SignedUploadParams[];
  try {
    params = await signAdminTourPhotoUploads(cookie, parsed.data);
  } catch (error) {
    return { ok: false, code: classifySignUploadsError(error) };
  }
  return { ok: true, params };
}

/** Kho ảnh địa danh — thủ tục không khai mã lỗi, nên chỉ còn lỗi vận chuyển. */
export async function loadTourPhotoLibraryAction(): Promise<PhotoLibraryResult> {
  const cookie = (await cookies()).toString();
  let library: AdminPhotoLibrary;
  try {
    library = await fetchTourPhotoLibrary(cookie);
  } catch (error) {
    return { ok: false, code: classifyWriteError(error, new Set<never>()) };
  }
  return { ok: true, library };
}
