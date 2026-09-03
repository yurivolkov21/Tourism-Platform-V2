'use server';

import {
  type AdminEnquiryAddNoteInput,
  AdminEnquiryAddNoteInputSchema,
  type AdminEnquirySetStatusInput,
  AdminEnquirySetStatusInputSchema,
  type EnquiryDetail,
} from '@tourism/contract';
import { updateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { addAdminEnquiryNote, setAdminEnquiryStatus } from '@/lib/api/enquiries';
import { ADMIN_STATS_TAG } from '@/lib/api/stats';
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
 * - `updateTag(ADMIN_STATS_TAG)` sau MỖI lệnh thành công: cả ba con số của
 *   `/enquiries` chỉ đổi vì chính hai action này (khác outbox/payment events
 *   — ở đó worker/webhook mới là kẻ đổi bảng nên stats không cache).
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
  let detail: EnquiryDetail;
  try {
    detail = await setAdminEnquiryStatus(cookie, parsed.data);
  } catch (error) {
    // `ORPCError` không sống sót qua ranh giới action (Next che lỗi server ở
    // production thành digest trống) — phân loại tại đây, trả mã trần xuống.
    return { ok: false, code: classifySetStatusError(error) };
  }
  updateTag(ADMIN_STATS_TAG);
  // Trạng thái đọc từ RESPONSE, không từ input đã gửi: no-op trùng trạng thái
  // cũng trả về đúng trạng thái thật, nên toast không bao giờ kể chuyện khác
  // với server.
  return setStatusSuccess(detail);
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
  // Thêm note KHÔNG đổi con số nào của hàng card (`created`/`won`/`open` đều
  // không đếm note) — nhưng nó đổi cột "Notes" của bảng, mà bảng thì đọc tươi
  // mỗi lần điều hướng. Vẫn `updateTag` cho cùng một luật với `setStatus`:
  // rẻ (một tag), và ngày nào card có thêm metric đếm note thì không phải
  // nhớ quay lại đây.
  updateTag(ADMIN_STATS_TAG);
  return { ok: true };
}
