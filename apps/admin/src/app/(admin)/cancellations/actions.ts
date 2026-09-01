'use server';

import {
  type DecideCancellationInput,
  DecideCancellationInputSchema,
  type DecideCancellationResult,
} from '@tourism/contract';
import { updateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { decideCancellation } from '@/lib/api/cancellations';
import { ADMIN_STATS_TAG } from '@/lib/api/stats';
import { classifyDecideError, type DecideActionResult } from '@/lib/cancellations-decide';

/**
 * Hành vi GHI của vùng cancellations (spec P4b §3-F3) — cùng khuôn đã chốt
 * qua review F2 ở `bookings/[code]/actions.ts`:
 *
 * - SERVER ACTION vì client oRPC của admin là đường server-only: action là
 *   chỗ duy nhất vừa đọc được cookie phiên qua `next/headers` vừa được gọi
 *   từ một nút trong client component.
 * - Quyền KHÔNG kiểm ở đây: server action là một endpoint POST mở như mọi
 *   endpoint khác, nên quyền gác ở nơi duy nhất đáng tin — `AuthGuard` +
 *   `@Roles(ADMIN)` của API, đọc chính cookie được forward.
 * - Input re-parse bằng CHÍNH schema contract trước khi đi: input hỏng phải
 *   ra `INVALID_INPUT` ("chưa từng rời lớp validate") chứ không phải câu
 *   GENERIC "có thể đã tới provider".
 * - `try` chỉ ôm ĐÚNG lời gọi: mọi lỗi sau-commit không được phép biến một
 *   approve thành công (tiền ĐÃ hoàn) thành thông báo thất bại.
 * - KHÔNG `revalidatePath`/`refresh()` ở đây: response phải về NGAY khi có
 *   kết quả; client tự `router.refresh()` sau khi đã báo xong cho admin.
 */
export async function decideCancellationAction(
  input: DecideCancellationInput,
): Promise<DecideActionResult> {
  const parsed = DecideCancellationInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let result: DecideCancellationResult;
  try {
    result = await decideCancellation(cookie, parsed.data);
  } catch (error) {
    // `ORPCError` không sống sót qua ranh giới action (Next che lỗi server ở
    // production thành digest trống) — phân loại tại đây, trả mã trần xuống.
    return { ok: false, code: classifyDecideError(error) };
  }
  // Số liệu stat card đổi theo lệnh ghi này (vòng vá review F5).
  updateTag(ADMIN_STATS_TAG);
  // Đọc kết cục từ RESPONSE của server (`request.status`), không từ input đã
  // gửi: nhánh nào thật sự chạy là chuyện của server, client chỉ kể lại.
  return {
    ok: true,
    approved: result.request.status === 'REFUNDED',
    bookingCode: result.request.bookingCode,
  };
}
