'use server';

import {
  type AdminAppearanceSetSlotInput,
  AdminAppearanceSetSlotInputSchema,
  type AdminAppearanceSignUploadInput,
  AdminAppearanceSignUploadInputSchema,
  type AdminSiteSlot,
  type SignedUploadParams,
} from '@tourism/contract';
import { cookies } from 'next/headers';
import { setAdminSiteSlot, signAdminSlotUpload } from '@/lib/api/appearance';
import {
  classifySetSlotError,
  classifySignSlotError,
  type SetSlotResult,
  type SignSlotResult,
} from '@/lib/appearance-write';

/**
 * Hành vi GHI của `/appearance` (ADR-0059) — cùng khuôn `posts/[slug]/actions.ts`: re-parse bằng
 * CHÍNH schema contract (hỏng là `INVALID_INPUT`), `cookies()` gọi ngoài `try`, `try` chỉ ôm đúng
 * lời gọi API. KHÔNG `revalidatePath`: client tự `router.refresh()`; cache WEB do API tự bust tag
 * `site-media` sau commit.
 */
export async function setSiteSlotAction(
  input: AdminAppearanceSetSlotInput,
): Promise<SetSlotResult> {
  const parsed = AdminAppearanceSetSlotInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let slot: AdminSiteSlot;
  try {
    slot = await setAdminSiteSlot(cookie, parsed.data);
  } catch (error) {
    return { ok: false, code: classifySetSlotError(error) };
  }
  return { ok: true, slot };
}

/**
 * Ký một lượt tải ảnh vào thư mục của khe — bộ tham số không mang api_secret (ADR-0021 §1), chữ
 * ký sống mười phút. publicId vào hàng dọn ngay lúc ký (phía API).
 */
export async function signSiteSlotUploadAction(
  input: AdminAppearanceSignUploadInput,
): Promise<SignSlotResult> {
  const parsed = AdminAppearanceSignUploadInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let params: SignedUploadParams;
  try {
    params = await signAdminSlotUpload(cookie, parsed.data);
  } catch (error) {
    return { ok: false, code: classifySignSlotError(error) };
  }
  return { ok: true, params };
}
