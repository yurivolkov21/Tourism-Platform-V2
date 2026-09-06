import type { ExecutionContext } from '@nestjs/common';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { ThrottlerRequest } from '@nestjs/throttler';
import type { SessionUser } from '../auth/auth.config.js';
import { IS_PUBLIC_KEY } from '../auth/public.decorator.js';
import { WriteOnlyThrottlerGuard } from '../auth/write-only-throttler.guard.js';
import { AUTHED_WRITE_THROTTLE, PUBLIC_WRITE_THROTTLE } from './throttle.js';

/**
 * Trần ghi MẶC ĐỊNH toàn cục (ADR-0037) — APP_GUARD đứng SAU AuthGuard nên
 * đọc được `sessionUser`. Đảo mặc định của ADR-0010 (opt-in từng route):
 * route ghi mới KHÔNG khai gì vẫn có trần từ lúc sinh ra — cùng nguyên tắc
 * fail-closed mà ADR-0003 đã áp cho auth.
 *
 * Bảng luật (kế thừa skip GET/HEAD/OPTIONS + miễn loopback ngoài production
 * từ {@link WriteOnlyThrottlerGuard}):
 * - non-GET có session  → AUTHED_WRITE_THROTTLE, bucket `user:<id>`
 * - non-GET @Public()   → PUBLIC_WRITE_THROTTLE (default của module), bucket IP
 * - non-GET không session, không @Public → 401 (fail-closed — thực tế
 *   AuthGuard đã chặn trước, nhánh này chỉ là đáy nếu thứ tự guard đổi)
 * - `@Throttle({ default: X })` per-route THẮNG mặc định (WEBHOOK_THROTTLE,
 *   SIGN_UPLOAD_THROTTLE, AUTH_THROTTLE); `@SkipThrottle()` miễn tường minh.
 */
@Injectable()
export class DefaultWriteThrottlerGuard extends WriteOnlyThrottlerGuard {
  protected override async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const { context, limit, ttl } = requestProps;
    // canActivate của base đã resolve limit/ttl: per-route @Throttle thắng,
    // không có thì là default module (PUBLIC_WRITE_THROTTLE). Chỉ khi đang ở
    // ĐÚNG default đó và request có session mới nâng sang trần authed —
    // route tự khai trần riêng thì tôn trọng nguyên vẹn.
    const isModuleDefault =
      limit === PUBLIC_WRITE_THROTTLE.limit && ttl === PUBLIC_WRITE_THROTTLE.ttl;
    const user = this.sessionUserOf(context);
    if (isModuleDefault && user) {
      return super.handleRequest({
        ...requestProps,
        limit: AUTHED_WRITE_THROTTLE.limit,
        ttl: AUTHED_WRITE_THROTTLE.ttl,
        blockDuration: AUTHED_WRITE_THROTTLE.ttl,
      });
    }
    return super.handleRequest(requestProps);
  }

  protected override async getTracker(
    req: Record<string, unknown>,
    context?: ExecutionContext,
  ): Promise<string> {
    // Bucket theo user cho request đã auth (kể cả khi route khai trần riêng):
    // theo IP thì NAT bị khoá oan còn pool IP xoay vòng lách được (W1).
    const user = (req as { sessionUser?: SessionUser }).sessionUser;
    if (user?.id) return `user:${user.id}`;
    if (context) {
      const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (isPublic) return super.getTracker(req);
    }
    // Fail-closed (cùng lý do AuthedWriteThrottlerGuard W1): rơi về IP là âm
    // thầm đổi trần theo-user thành theo-IP; bucket 'unknown' chung là để một
    // kẻ bất kỳ khoá route cho cả thế giới.
    throw new UnauthorizedException('DefaultWriteThrottlerGuard requires a session or @Public()');
  }

  private sessionUserOf(context: ExecutionContext): SessionUser | undefined {
    return context.switchToHttp().getRequest<{ sessionUser?: SessionUser }>().sessionUser;
  }
}
