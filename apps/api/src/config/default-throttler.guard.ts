import { timingSafeEqual } from 'node:crypto';
import type { ExecutionContext } from '@nestjs/common';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ThrottlerException, type ThrottlerRequest } from '@nestjs/throttler';
import type { SessionUser } from '../auth/auth.config.js';
import { IS_PUBLIC_KEY } from '../auth/public.decorator.js';
import { WriteOnlyThrottlerGuard } from '../auth/write-only-throttler.guard.js';
import { UserRole } from '../generated/prisma/enums.js';
import { env, publicReadThrottleMode } from './env.js';
import { ADMIN_WRITE_THROTTLE, AUTHED_WRITE_THROTTLE, PUBLIC_READ_THROTTLE } from './throttle.js';

/**
 * Khoá metadata của `@Throttle({ default: … })` — @nestjs/throttler 6.5.0
 * không re-export `throttler.constants`, nên chép đúng chuỗi (`THROTTLER:LIMIT`
 * + tên throttler). Đọc metadata là cách duy nhất biết route "có khai gì
 * không"; bản đầu đoán bằng so SỐ (`limit === 5 && ttl === 60000`), tức một
 * route cố ý ghim đúng 5/60s cho cả người đã đăng nhập sẽ bị nâng nhầm.
 */
const THROTTLE_LIMIT_METADATA = 'THROTTLER:LIMITdefault';

/** Header server-to-server của web SSR/build — khớp INTERNAL_READ_KEY là miễn bucket đọc. */
export const INTERNAL_READ_KEY_HEADER = 'x-internal-read-key';

/** Cùng danh sách loopback với WriteOnlyThrottlerGuard — xem lý do ở đó. */
const LOOPBACK_IPS = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/** Cờ gắn lên request khi đang đếm bucket ĐỌC — generateKey đọc để tách key. */
const READ_BUCKET = Symbol('readBucket');

interface ThrottledRequest {
  sessionUser?: SessionUser;
  method?: string;
  url?: string;
  routeOptions?: { url?: string };
  headers?: Record<string, string | string[] | undefined>;
  [READ_BUCKET]?: boolean;
}

/**
 * Trần MẶC ĐỊNH toàn cục cho CẢ ghi lẫn đọc công khai (ADR-0037 + AMEND 1 +
 * AMEND 2 + vòng vá review W4) — APP_GUARD đứng SAU AuthGuard nên đọc được
 * `sessionUser`. Đảo mặc định của ADR-0010 (opt-in từng route): route mới
 * KHÔNG khai gì vẫn có trần từ lúc sinh ra. Tên bỏ chữ "Write" từ W4 R1: GET
 * `@Public()` nay đếm bucket ĐỌC riêng — vẫn MỘT guard, không guard thứ hai
 * (hai guard cùng kế thừa ThrottlerGuard là hai lượt đếm cho một request và
 * thứ tự APP_GUARD thành load-bearing vô hình).
 *
 * Bảng luật (miễn loopback ngoài production kế thừa từ
 * {@link WriteOnlyThrottlerGuard}; HEAD/OPTIONS không bao giờ đếm):
 * - GET có `sessionUser` (route đã-auth, kể cả admin) → KHÔNG đếm — khách
 *   đăng nhập là đối tượng của trần GHI theo user.
 * - GET mang header `x-internal-read-key` khớp `INTERNAL_READ_KEY` → KHÔNG
 *   đếm: đó là web SSR/build/ISR (61 route prerender × 2–6 call từ MỘT egress
 *   IP dùng chung của Vercel) — vòng vá review W4: web KHÔNG forward cookie
 *   cho GET catalog nên carve-out "GET có session" của bản gốc không phủ
 *   đường này, và 429 lúc build là build đỏ.
 * - GET `@Public()` → PUBLIC_READ_THROTTLE 300/60s, bucket `read` MỘT cho
 *   mọi route đọc theo IP (per-route là nhân trần: một trang tour ≈ 6 call
 *   qua nhiều endpoint). Chế độ theo `PUBLIC_READ_THROTTLE_MODE`: `log` (mặc
 *   định — đếm, warn khi chạm, KHÔNG 429) cho tới khi `req.ip` trên Render
 *   được đo thật; `enforce` mới trả 429. Bucket đọc dùng throttler TÊN
 *   `default` (tách bằng key, không bằng tên): thư viện đặt tên header theo
 *   tên throttler — `read` từng phát `Retry-After-read` thay vì `Retry-After`.
 * - GET public trên route KHAI `@Throttle` riêng (AuthController wildcard —
 *   `get-session` từ egress IP DÙNG CHUNG của Vercel) → MIỄN hoàn toàn: trần
 *   đọc chỉ là mặc định cho route không khai gì, còn AUTH_THROTTLE cố ý chỉ
 *   đếm non-GET. Đây là "miễn", KHÔNG phải "thi hành trần đã khai cho GET".
 * - GET không public, không session → bỏ qua (AuthGuard đã 401 trước).
 * - non-GET có session, dưới `/api/admin/*`, role ADMIN → ADMIN_WRITE_THROTTLE
 * - non-GET có session → AUTHED_WRITE_THROTTLE, bucket `user:<id>`
 * - non-GET `@Public()` → PUBLIC_WRITE_THROTTLE (default của module), bucket IP.
 *   LƯU Ý: AuthGuard thoát sớm trên route `@Public()` TRƯỚC khi gắn
 *   `sessionUser`, nên route public KHÔNG BAO GIỜ có user ở đây.
 * - `@Throttle({ default: X })` per-route THẮNG mặc định (WEBHOOK_THROTTLE,
 *   AUTH_THROTTLE); `@SkipThrottle()` miễn tường minh.
 * - Handler wildcard (AuthController `api/auth/*`) → key nối thêm pathname.
 * - non-GET không session, không `@Public()` → 401 (đáy, AuthGuard đã chặn).
 */
@Injectable()
export class DefaultThrottlerGuard extends WriteOnlyThrottlerGuard {
  private readonly logger = new Logger(DefaultThrottlerGuard.name);
  /** Đã warn cho tracker nào trong cửa sổ hiện tại (chế độ log) — chống bão log. */
  private readonly warned = new Map<string, number>();

  /**
   * Đè shouldSkip của lớp cha: KHÔNG skip GET nữa (W4 R1) — GET đi tiếp vào
   * handleRequest để rẽ nhánh đọc; HEAD/OPTIONS và loopback ngoài production
   * giữ nguyên luật cũ.
   */
  protected override async shouldSkip(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<{ method?: string; socket?: { remoteAddress?: string } }>();
    const method = req.method?.toUpperCase();
    if (method === 'HEAD' || method === 'OPTIONS') return true;
    if (env.NODE_ENV === 'production') return false;
    const raw = req.socket?.remoteAddress;
    return raw !== undefined && LOOPBACK_IPS.has(raw);
  }

  protected override async handleRequest(requestProps: ThrottlerRequest): Promise<boolean> {
    const { context } = requestProps;
    const req = this.requestOf(context);
    const user = req.sessionUser;

    // ── Nhánh ĐỌC (W4 R1, ADR-0037 AMEND 2) ──
    if (req.method?.toUpperCase() === 'GET') {
      if (user) return true;
      if (hasInternalReadKey(req)) return true;
      const declaredForRead = this.reflector.getAllAndOverride<number | undefined>(
        THROTTLE_LIMIT_METADATA,
        [context.getHandler(), context.getClass()],
      );
      if (declaredForRead !== undefined) return true;
      const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
      if (!isPublic) return true;
      req[READ_BUCKET] = true;
      try {
        return await super.handleRequest({
          ...requestProps,
          limit: PUBLIC_READ_THROTTLE.limit,
          ttl: PUBLIC_READ_THROTTLE.ttl,
          blockDuration: PUBLIC_READ_THROTTLE.ttl,
        });
      } catch (error) {
        if (!(error instanceof ThrottlerException) || publicReadThrottleMode === 'enforce') {
          throw error;
        }
        // Chế độ log: chạm trần thì ghi một dòng mỗi IP mỗi cửa sổ và cho qua.
        this.logReadLimitHit(await super.getTracker(req as Record<string, unknown>));
        return true;
      }
    }
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
    throw new UnauthorizedException('DefaultThrottlerGuard requires a session or @Public()');
  }

  protected override generateKey(context: ExecutionContext, suffix: string, name: string): string {
    const req = this.requestOf(context);
    // Bucket đọc là MỘT theo IP cho MỌI route công khai (W4 R1): key cố ý
    // KHÔNG chứa class/handler như bản mặc định — per-route là nhân trần 300
    // lên theo số endpoint, trong khi con số được chọn theo cả TRANG
    // (ADR-0037 AMEND 2: ~6 call/trang qua nhiều endpoint). Tách bằng KEY,
    // tên throttler giữ `default` để header chuẩn (`Retry-After`).
    if (req[READ_BUCKET]) return `throttler:read:${suffix}`;
    const route = req.routeOptions?.url ?? '';
    // Wildcard = một handler cho nhiều đường (Better Auth mount): tách bucket
    // theo pathname thật, không thì sign-in/sign-up/OTP/sign-out chia nhau
    // 60/phút của cả CGNAT (vòng vá review W2).
    const pathname = route.includes('*') ? `:${(req.url ?? '').split('?')[0]}` : '';
    return super.generateKey(context, `${suffix}${pathname}`, name);
  }

  private logReadLimitHit(tracker: string, now = Date.now()): void {
    const last = this.warned.get(tracker);
    if (last !== undefined && now - last < PUBLIC_READ_THROTTLE.ttl) return;
    if (this.warned.size > 10_000) this.warned.clear();
    this.warned.set(tracker, now);
    this.logger.warn(
      `public-read-throttle would block ${JSON.stringify({ tracker, limit: PUBLIC_READ_THROTTLE.limit, mode: 'log' })}`,
    );
  }

  private requestOf(context: ExecutionContext): ThrottledRequest {
    return context.switchToHttp().getRequest<ThrottledRequest>();
  }
}

/** Header khớp INTERNAL_READ_KEY (so timing-safe); không có env → không ai được miễn. */
export function hasInternalReadKey(req: { headers?: Record<string, unknown> }): boolean {
  const expected = env.INTERNAL_READ_KEY;
  if (!expected) return false;
  const raw = req.headers?.[INTERNAL_READ_KEY_HEADER];
  const given = Array.isArray(raw) ? raw[0] : raw;
  if (typeof given !== 'string' || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/** Đường admin — cùng phép so với CORS delegator ở `bootstrap.ts` (bỏ query). */
function isAdminSurface(url: string | undefined): boolean {
  const path = (url ?? '').split('?')[0] ?? '';
  return path === '/api/admin' || path.startsWith('/api/admin/');
}
