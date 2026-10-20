import {
  type CallHandler,
  type ExecutionContext,
  Logger,
  type NestInterceptor,
} from '@nestjs/common';
import { type AnyMiddleware, DecoratedProcedure, isProcedure } from '@orpc/server';
import type { ActivityLoggedProcedure } from '@tourism/contract';
import { map, type Observable } from 'rxjs';
import type { AuthenticatedRequest } from '../../auth/auth.guard.js';
import { ACTIVITY_DESCRIBERS, type ActivityEntry } from './activity-describers.js';
import { type ActivityActor, actorFromSession, recordActivitySafely } from './activity-recorder.js';

const logger = new Logger('AdminActivity');

/** Mô tả đã xoá kiểu theo khoá — middleware dùng chung cho mọi khoá nên chỉ thấy `unknown`. */
interface ErasedDescriber {
  before?: (input: unknown) => Promise<string | null>;
  describe: (args: {
    input: unknown;
    output: unknown;
    before: string | null;
  }) => ActivityEntry | null | Promise<ActivityEntry | null>;
}

export type ActivityRecordFn = typeof recordActivitySafely;

/** Kết quả `next()` của middleware oRPC (`MiddlewareResult`): object, có thể bọc Promise. */
interface NextResult {
  output: unknown;
  context: unknown;
}
type Promisable<T> = T | PromiseLike<T>;

/**
 * Middleware oRPC ghi một dòng nhật ký sau khi handler THÀNH CÔNG (ADR-0061 §3, §4). Nối SAU mọi
 * middleware có sẵn nên chạy sau bước kiểm input; handler ném thì `next()` ném và không có dòng
 * nào. Bước `before` lỗi thì không chặn thao tác: lệnh xoá ghi nhãn trống, lệnh so dấu thì vẫn ghi
 * như một lệnh có đổi.
 */
export function activityMiddleware(
  key: ActivityLoggedProcedure,
  getActor: () => ActivityActor | null,
  record: ActivityRecordFn = recordActivitySafely,
): AnyMiddleware {
  const describer = ACTIVITY_DESCRIBERS[key] as unknown as ErasedDescriber;
  const middleware = async ({ next }: { next: () => Promisable<NextResult> }, input: unknown) => {
    let before: string | null = null;
    if (describer.before) {
      try {
        before = await describer.before(input);
      } catch (error) {
        logger.warn(
          `Không đọc được giá trị trước ${key}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    const result = await next();
    const actor = getActor();
    if (actor) {
      await record(actor, key, async () =>
        describer.describe({ input, output: result.output, before }),
      );
    }
    return result;
  };
  return middleware as AnyMiddleware;
}

/**
 * Nối middleware nhật ký vào procedure mà method của controller trả về. Thứ không phải procedure thì
 * trả nguyên — `ImplementInterceptor` sẽ tự báo lỗi của nó.
 */
export function withActivity(
  impl: unknown,
  key: ActivityLoggedProcedure,
  getActor: () => ActivityActor | null,
  record: ActivityRecordFn = recordActivitySafely,
): unknown {
  if (!isProcedure(impl)) return impl;
  const decorated =
    impl instanceof DecoratedProcedure ? impl : new DecoratedProcedure(impl['~orpc']);
  return decorated.use(activityMiddleware(key, getActor, record));
}

/**
 * Interceptor Nest do `@AdminImplement` gắn cho thủ tục `log` (ADR-0061 §3). Nó nằm TRONG
 * `ImplementInterceptor` của `@orpc/nest`: `next.handle()` phát ra procedure mà method trả về, ta
 * nối middleware rồi trả lại cho `ImplementInterceptor` chạy. Người làm đọc từ `sessionUser` mà
 * AuthGuard đã gắn (guard chạy trước mọi interceptor).
 */
export class AdminActivityInterceptor implements NestInterceptor {
  constructor(
    readonly key: ActivityLoggedProcedure,
    private readonly record: ActivityRecordFn = recordActivitySafely,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const getActor = () => (request.sessionUser ? actorFromSession(request.sessionUser) : null);
    return next.handle().pipe(map((impl) => withActivity(impl, this.key, getActor, this.record)));
  }
}
