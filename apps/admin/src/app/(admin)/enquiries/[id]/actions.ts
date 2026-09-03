'use server';

import {
  type AdminEnquiryAddNoteInput,
  AdminEnquiryAddNoteInputSchema,
  type AdminEnquirySetStatusInput,
  AdminEnquirySetStatusInputSchema,
  type AdminEnquirySetStatusResult,
} from '@tourism/contract';
import { cookies } from 'next/headers';
import { addAdminEnquiryNote, setAdminEnquiryStatus } from '@/lib/api/enquiries';
import {
  type AddNoteActionResult,
  classifyAddNoteError,
  classifySetStatusError,
  type SetStatusActionResult,
  setStatusSuccess,
} from '@/lib/enquiries-write';

/**
 * HAI hành vi ghi của vùng enquiries (spec P4c §3-F9) — cùng khuôn đã chốt ở
 * `bookings/[code]/actions.ts` và `outbox/actions.ts`:
 *
 * - SERVER ACTION vì client oRPC của admin là đường server-only (đọc cookie
 *   phiên qua `next/headers`), được gọi từ một nút trong client component.
 * - Quyền KHÔNG kiểm ở đây: server action là một endpoint POST mở như mọi
 *   endpoint khác, nên gác ở `AuthGuard` + `@Roles(ADMIN)` của API — nơi
 *   duy nhất đáng tin, đọc chính cookie được forward.
 * - Input re-parse bằng CHÍNH schema contract TRƯỚC khi đi: input hỏng phải
 *   ra mã `INVALID_INPUT` ("chưa từng rời lớp validate") chứ không phải câu
 *   GENERIC mập mờ.
 * - `cookies()` gọi NGOÀI `try`, và `try` chỉ ôm ĐÚNG lời gọi API: một lỗi
 *   sau-commit không được phép biến một lệnh ghi đã ăn thành thông báo
 *   thất bại.
 * - KHÔNG `updateTag`: stats vùng này không cache (vòng vá review F9 — form
 *   khách công khai cũng ghi bảng), nên không có tag nào để huỷ.
 * - KHÔNG `revalidatePath`/`refresh()` ở đây: trang chi tiết là server
 *   component ĐỘNG (đọc `cookies()`), nên không có bản cache nào để huỷ —
 *   thứ vẽ lại nó là `router.refresh()` mà client gọi SAU khi đã báo xong
 *   cho admin (đóng dialog + toast không phải chờ thêm 2 RTT re-render).
 */

export async function setEnquiryStatusAction(
  input: AdminEnquirySetStatusInput,
): Promise<SetStatusActionResult> {
  const parsed = AdminEnquirySetStatusInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let result: AdminEnquirySetStatusResult;
  try {
    result = await setAdminEnquiryStatus(cookie, parsed.data);
  } catch (error) {
    // `ORPCError` không sống sót qua ranh giới action (Next che lỗi server ở
    // production thành digest trống) — phân loại tại đây, trả mã trần xuống.
    return { ok: false, code: classifySetStatusError(error) };
  }
  // Trạng thái + cờ `changed` đọc từ RESPONSE, không từ input đã gửi: no-op
  // trùng trạng thái trả đúng trạng thái thật và `changed: false`, nên toast
  // không bao giờ kể chuyện khác với server.
  return setStatusSuccess(result);
}

export async function addEnquiryNoteAction(
  input: AdminEnquiryAddNoteInput,
): Promise<AddNoteActionResult> {
  const parsed = AdminEnquiryAddNoteInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  try {
    await addAdminEnquiryNote(cookie, parsed.data);
  } catch (error) {
    return { ok: false, code: classifyAddNoteError(error) };
  }
  return { ok: true };
}
