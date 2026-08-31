'use server';

import type { AdminRefundInput } from '@tourism/contract';
import { refresh } from 'next/cache';
import { cookies } from 'next/headers';
import type { RefundActionResult } from '@/components/bookings/refund-panel';
import { refundAdminBooking } from '@/lib/api/bookings';
import { classifyRefundError } from '@/lib/refund';

/**
 * Hành vi GHI đầu tiên của admin (spec P4b §3-F2, quyết định §2.4 — "server
 * action hoặc route handler"). Chọn SERVER ACTION vì client oRPC của admin là
 * đường server-only (`lib/api/client.ts` — không có nhánh `credentials:
 * 'include'`): action là chỗ duy nhất vừa đọc được cookie phiên qua
 * `next/headers` vừa được gọi từ một nút trong client component. Route
 * handler sẽ phải dựng thêm một URL + một lớp parse input, đổi lại không
 * được gì.
 *
 * Ai chặn quyền: KHÔNG phải action này. Server action là một endpoint POST
 * mở như mọi endpoint khác, nên quyền được kiểm ở nơi duy nhất đáng tin —
 * `AuthGuard` + `@Roles(ADMIN)` của API, đọc chính cookie được forward. Phiên
 * chết → 401, tài khoản mất quyền admin → 403, và cả hai đều có copy riêng.
 *
 * Lỗi được PHÂN LOẠI ở đây rồi mới trả xuống: `ORPCError` không sống sót qua
 * ranh giới server action (Next che lỗi server ở production thành một digest
 * trống), nên ném tiếp là đánh mất đúng thứ mà §2.4 bắt phải giữ — sự khác
 * nhau giữa năm mã 422/502.
 *
 * Làm tươi trang bằng `refresh()` của `next/cache` (Next 16 — chỉ gọi được
 * TRONG server action): nó refetch RSC payload của chính route này và gửi kèm
 * response của action, tức một roundtrip thay vì hai như `router.refresh()`
 * phía client. KHÔNG dùng `revalidatePath`/`updateTag`: trang chi tiết đọc
 * `cookies()` và client oRPC đặt `cache: 'no-store'` vô điều kiện, nên không
 * có gì trong Data Cache để xoá — chúng sẽ là no-op cho đúng thứ ta cần tươi.
 * State client (bảng sổ cái vừa hiện) sống sót qua refresh.
 */
export async function refundBookingAction(input: AdminRefundInput): Promise<RefundActionResult> {
  const cookie = (await cookies()).toString();
  try {
    const result = await refundAdminBooking(cookie, input);
    // `booking.status` là projection server vừa suy ra lại từ ledger
    // (PARTIALLY_REFUNDED/REFUNDED) — trang dùng nó để tắt nút ngay, không
    // chờ `router.refresh()` xong.
    refresh();
    return { ok: true, status: result.booking.status, refunds: result.refunds };
  } catch (error) {
    return { ok: false, code: classifyRefundError(error) };
  }
}
