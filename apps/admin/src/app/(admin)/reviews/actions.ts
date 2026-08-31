'use server';

import {
  type AdminReview,
  type ModerateReviewInput,
  ModerateReviewInputSchema,
} from '@tourism/contract';
import { cookies } from 'next/headers';
import { moderateReview } from '@/lib/api/reviews';
import { classifyModerateError, type ModerateActionResult } from '@/lib/reviews-moderate';

/**
 * Hành vi GHI của vùng reviews (spec P4b §3-F4) — cùng khuôn đã chốt qua
 * review F2/F3 (`bookings/[code]/actions.ts`, `cancellations/actions.ts`):
 *
 * - SERVER ACTION vì client oRPC của admin là đường server-only: action là
 *   chỗ duy nhất vừa đọc được cookie phiên qua `next/headers` vừa được gọi
 *   từ một nút trong client component.
 * - Quyền KHÔNG kiểm ở đây: server action là một endpoint POST mở như mọi
 *   endpoint khác, nên quyền gác ở nơi duy nhất đáng tin — `AuthGuard` +
 *   `@Roles(ADMIN)` của API, đọc chính cookie được forward.
 * - Input re-parse bằng CHÍNH schema contract trước khi đi: input hỏng phải
 *   ra `INVALID_INPUT` ("chưa từng rời lớp validate") chứ không phải câu
 *   GENERIC "không rõ đã tới đâu".
 * - `try` chỉ ôm ĐÚNG lời gọi: transaction phía server đã commit (review đã
 *   lên trang tour, email đã vào outbox) mà một lỗi sau đó biến nó thành
 *   thông báo thất bại là admin sẽ bấm lại một lệnh đã chạy xong.
 * - KHÔNG `revalidatePath`/`refresh()` ở đây: response phải về NGAY khi có
 *   kết quả; client tự `router.refresh()` sau khi đã báo xong cho admin.
 */
export async function moderateReviewAction(
  input: ModerateReviewInput,
): Promise<ModerateActionResult> {
  const parsed = ModerateReviewInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let review: AdminReview;
  try {
    review = await moderateReview(cookie, parsed.data);
  } catch (error) {
    // `ORPCError` không sống sót qua ranh giới action (Next che lỗi server ở
    // production thành digest trống) — phân loại tại đây, trả mã trần xuống.
    return { ok: false, code: classifyModerateError(error) };
  }
  // Đọc kết cục từ RESPONSE của server (`review.isApproved`), không từ input
  // đã gửi: trạng thái cuối cùng là chuyện của server, client chỉ kể lại.
  return { ok: true, approved: review.isApproved };
}
