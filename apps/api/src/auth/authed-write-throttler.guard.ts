import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { AuthenticatedRequest } from './auth.guard.js';

/**
 * ThrottlerGuard cho endpoint GHI ĐÃ-AUTH (W1, audit 05/09 cụm 2): tracker là
 * `user.id` của session thay vì IP mặc định — theo IP thì cả một NAT/proxy
 * chung IP bị khoá oan theo nhau, còn một tài khoản đi qua pool IP xoay vòng
 * không bao giờ chạm trần.
 *
 * Xếp SAU AuthGuard trong chuỗi guard (`sessionUser` do AuthGuard gắn). Request
 * chưa có session (route gắn nhầm guard này mà không có auth, hoặc `@Public()`
 * đợt sau) bị TỪ CHỐI 401 — fail-closed thật (vòng vá review 06/09): rơi về IP
 * là âm thầm đổi trần theo-user thành theo-IP, còn một bucket 'unknown' chung
 * là để 20 request của một kẻ bất kỳ khoá route cho cả thế giới.
 * Trần cụ thể khai per-route qua `@Throttle({ default: AUTHED_WRITE_THROTTLE })`.
 */
@Injectable()
export class AuthedWriteThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = (req as Partial<AuthenticatedRequest>).sessionUser;
    if (user?.id) return `user:${user.id}`;
    throw new UnauthorizedException('AuthedWriteThrottlerGuard requires an authenticated session');
  }
}
