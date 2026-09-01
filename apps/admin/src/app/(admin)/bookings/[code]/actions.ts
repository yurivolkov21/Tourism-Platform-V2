'use server';

import {
  type AdminRefundInput,
  AdminRefundInputSchema,
  type AdminRefundResult,
} from '@tourism/contract';
import { updateTag } from 'next/cache';
import { cookies } from 'next/headers';
import { refundAdminBooking } from '@/lib/api/bookings';
import { ADMIN_STATS_TAG } from '@/lib/api/stats';
import { classifyRefundError, type RefundActionResult } from '@/lib/refund';

/**
 * Hành vi GHI đầu tiên của admin (spec P4b §3-F2, quyết định §2.4 — "server
 * action hoặc route handler"). Chọn SERVER ACTION vì client oRPC của admin là
 * đường server-only (`lib/api/client.ts` — không có nhánh `credentials:
 * 'include'`): action là chỗ duy nhất vừa đọc được cookie phiên qua
 * `next/headers` vừa được gọi từ một nút trong client component.
 *
 * Ai chặn quyền: KHÔNG phải action này. Server action là một endpoint POST
 * mở như mọi endpoint khác, nên quyền được kiểm ở nơi duy nhất đáng tin —
 * `AuthGuard` + `@Roles(ADMIN)` của API, đọc chính cookie được forward.
 *
 * Ba luật vòng vá review 31/08:
 * - Input được re-parse bằng CHÍNH `AdminRefundInputSchema` trước khi đi:
 *   action là endpoint mở, input hỏng phải ra mã `INVALID_INPUT` ("chưa từng
 *   rời lớp validate") chứ không phải câu GENERIC "có thể đã tới provider".
 * - `try` chỉ ôm ĐÚNG lời gọi tiền: mọi lỗi sau-commit không được phép biến
 *   một refund thành công thành thông báo thất bại.
 * - KHÔNG `refresh()` ở đây: response của action phải về NGAY khi có kết quả
 *   (đóng dialog + toast không chờ 2 RTT re-render); client tự
 *   `router.refresh()` sau khi đã báo xong cho admin.
 */
export async function refundBookingAction(input: AdminRefundInput): Promise<RefundActionResult> {
  const parsed = AdminRefundInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, code: 'INVALID_INPUT' };

  const cookie = (await cookies()).toString();
  let result: AdminRefundResult;
  try {
    result = await refundAdminBooking(cookie, parsed.data);
  } catch (error) {
    // `ORPCError` không sống sót qua ranh giới action (Next che lỗi server ở
    // production thành digest trống) — phân loại tại đây, trả mã trần xuống.
    return { ok: false, code: classifyRefundError(error) };
  }
  // `booking.status` là projection server suy lại từ ledger — client dùng để
  // tắt nút ngay trong lúc `router.refresh()` chạy.
  // Số liệu stat card đổi theo lệnh ghi này — hết hạn cache tag NGAY để
  // admin thấy số tươi sau chính hành động của mình (vòng vá review F5).
  updateTag(ADMIN_STATS_TAG);
  return { ok: true, status: result.booking.status, refunds: result.refunds };
}
