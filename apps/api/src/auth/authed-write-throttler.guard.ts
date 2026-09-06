import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { AuthenticatedRequest } from './auth.guard.js';

/**
 * ThrottlerGuard cho endpoint GHI ĐÃ-AUTH (W1, audit 05/09 cụm 2): tracker là
 * `user.id` của session thay vì IP mặc định — theo IP thì cả một NAT/proxy
 * chung IP bị khoá oan theo nhau, còn một tài khoản đi qua pool IP xoay vòng
 * không bao giờ chạm trần.
 *
 * Xếp SAU AuthGuard trong chuỗi guard (`sessionUser` do AuthGuard gắn); request
 * chưa có session (route lọt vào đây trước khi auth chạy — không nên xảy ra)
 * rơi về IP để guard vẫn fail-closed thay vì gom tất cả vào một bucket chung.
 * Trần cụ thể khai per-route qua `@Throttle({ default: AUTHED_WRITE_THROTTLE })`.
 */
@Injectable()
export class AuthedWriteThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = (req as Partial<AuthenticatedRequest>).sessionUser;
    if (user?.id) return `user:${user.id}`;
    const ip = (req as { ip?: string }).ip;
    return ip ?? 'unknown';
  }
}
