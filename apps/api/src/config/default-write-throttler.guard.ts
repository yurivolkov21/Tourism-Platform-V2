import type { ExecutionContext } from '@nestjs/common';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { ThrottlerRequest } from '@nestjs/throttler';
import type { SessionUser } from '../auth/auth.config.js';
import { IS_PUBLIC_KEY } from '../auth/public.decorator.js';
import { WriteOnlyThrottlerGuard } from '../auth/write-only-throttler.guard.js';
import { UserRole } from '../generated/prisma/enums.js';
import { ADMIN_WRITE_THROTTLE, AUTHED_WRITE_THROTTLE } from './throttle.js';

/**
 * Khoá metadata của `@Throttle({ default: … })` — @nestjs/throttler 6.5.0
 * không re-export `throttler.constants`, nên chép đúng chuỗi (`THROTTLER:LIMIT`
 * + tên throttler). Đọc metadata là cách duy nhất biết route "có khai gì
 * không"; bản đầu đoán bằng so SỐ (`limit === 5 && ttl === 60000`), tức một
 * route cố ý ghim đúng 5/60s cho cả người đã đăng nhập sẽ bị nâng nhầm.
 */
const THROTTLE_LIMIT_METADATA = 'THROTTLER:LIMITdefault';

interface ThrottledRequest {
  sessionUser?: SessionUser;
  url?: string;
  routeOptions?: { url?: string };
}

/**
 * Trần ghi MẶC ĐỊNH toàn cục (ADR-0037 + AMEND 1) — APP_GUARD đứng SAU
 * AuthGuard nên đọc được `sessionUser`. Đảo mặc định của ADR-0010 (opt-in
 * từng route): route ghi mới KHÔNG khai gì vẫn có trần từ lúc sinh ra.
 *
 * Bảng luật (kế thừa skip GET/HEAD/OPTIONS + miễn loopback ngoài production
 * từ {@link WriteOnlyThrottlerGuard}):
 * - non-GET có session, dưới `/api/admin/*`, role ADMIN → ADMIN_WRITE_THROTTLE
 * - non-GET có session → AUTHED_WRITE_THROTTLE, bucket `user:<id>`
 * - non-GET `@Public()` → PUBLIC_WRITE_THROTTLE (default của module), bucket IP.
 *   LƯU Ý: AuthGuard thoát sớm trên route `@Public()` TRƯỚC khi gắn
 *   `sessionUser`, nên route public KHÔNG BAO GIỜ có user ở đây — kể cả khi
 *   người gọi đang đăng nhập (sign-out, newsletter khi đã login). Đúng ý:
 *   bề mặt public đếm theo IP.
 * - `@Throttle({ default: X })` per-route THẮNG mặc định (WEBHOOK_THROTTLE,
 *   AUTH_THROTTLE); `@SkipThrottle()` miễn tường minh.
 * - Handler wildcard (AuthController `api/auth/*`) → key nối thêm pathname:
 *   sign-in, sign-up, OTP, sign-out mỗi cái một bucket, không chia chung.
 * - non-GET không session, không `@Public()` → 401. AuthGuard đã chặn ca này
 *   trước, nhánh chỉ là đáy nếu thứ tự guard đổi — không có test nào tới được.
 */
@Injectable()
export class DefaultWriteThrottlerGuard extends WriteOnlyThrottlerGuard {
  protected override async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const { context } = requestProps;
    const req = this.requestOf(context);
    const user = req.sessionUser;
    // Route khai `@Throttle` riêng thì tôn trọng nguyên vẹn; chỉ route KHÔNG
    // khai gì (metadata vắng ở cả handler lẫn class) mới được nâng theo session.
    const declared = this.reflector.getAllAndOverride<number | undefined>(THROTTLE_LIMIT_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (declared === undefined && user) {
      const tier =
        user.role === UserRole.ADMIN && isAdminSurface(req.url)
          ? ADMIN_WRITE_THROTTLE
          : AUTHED_WRITE_THROTTLE;
      return super.handleRequest({
        ...requestProps,
        limit: tier.limit,
        ttl: tier.ttl,
        blockDuration: tier.ttl,
      });
    }
    return super.handleRequest(requestProps);
  }

  protected override async getTracker(
    req: Record<string, unknown>,
    context?: ExecutionContext,
  ): Promise<string> {
    // Bucket theo user cho request đã auth: theo IP thì NAT bị khoá oan còn
    // pool IP xoay vòng lách được (W1).
    const user = (req as ThrottledRequest).sessionUser;
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

  protected override generateKey(context: ExecutionContext, suffix: string, name: string): string {
    const req = this.requestOf(context);
    const route = req.routeOptions?.url ?? '';
    // Wildcard = một handler cho nhiều đường (Better Auth mount): tách bucket
    // theo pathname thật, không thì sign-in/sign-up/OTP/sign-out chia nhau
    // 60/phút của cả CGNAT (vòng vá review W2).
    const pathname = route.includes('*') ? `:${(req.url ?? '').split('?')[0]}` : '';
    return super.generateKey(context, `${suffix}${pathname}`, name);
  }

  private requestOf(context: ExecutionContext): ThrottledRequest {
    return context.switchToHttp().getRequest<ThrottledRequest>();
  }
}

/** Đường admin — cùng phép so với CORS delegator ở `bootstrap.ts` (bỏ query). */
function isAdminSurface(url: string | undefined): boolean {
  const path = (url ?? '').split('?')[0] ?? '';
  return path === '/api/admin' || path.startsWith('/api/admin/');
}
