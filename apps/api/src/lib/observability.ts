import { Logger } from '@nestjs/common';
import type { Breadcrumb, ErrorEvent } from '@sentry/node';
import * as Sentry from '@sentry/node';

const logger = new Logger('Observability');

/** Bật sau `initObservability` có DSN; trước đó `captureException` là no-op. */
let enabled = false;

/**
 * ADR-0010 §3 và AMEND 1: bật Sentry MỘT lần lúc boot (`main.ts`, `worker.ts`), trước khi
 * Nest dựng app. Thiếu DSN thì không làm gì và trả `false`: dev, test, CI chạy y như seam cũ.
 *
 * Chỉ bắt lỗi: không `tracesSampleRate` nên SDK không thêm integration hiệu năng, và không
 * móc ESM loader (móc ấy bọc mọi `import()` động về sau, mà không tracing thì không cần).
 */
export function initObservability(config: {
  dsn: string | undefined;
  environment: string;
}): boolean {
  if (!config.dsn) return false;
  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    // Release: SDK tự đọc RENDER_GIT_COMMIT mà Render cấp sẵn.
    sendDefaultPii: false,
    registerEsmLoaderHooks: false,
    beforeSend: scrubEvent,
    beforeBreadcrumb: dropConsoleBreadcrumb,
    // Mặc định của Sentry là `warn`: ghi log rồi chạy tiếp, tức gắn Sentry vào là tiến trình
    // thôi chết khi có promise bị reject không ai bắt (Node 15+ thì chết). `strict` gửi lỗi,
    // xả hàng đợi rồi exit(1), giữ đúng hành vi cũ.
    integrations: (defaults) =>
      defaults.map((integration) =>
        integration.name === 'OnUnhandledRejection'
          ? Sentry.onUnhandledRejectionIntegration({ mode: 'strict' })
          : integration,
      ),
  });
  enabled = true;
  logger.log(`Sentry bật (environment=${config.environment})`);
  return true;
}

/**
 * Đẩy một lỗi bất ngờ (500) lên Sentry. Hai call-site: exception filter toàn cục và
 * `onError` của oRPC. Chưa init (thiếu DSN) thì no-op; lỗi vẫn có `Logger.error` của
 * call-site ra stdout của Render.
 */
export function captureException(error: unknown): void {
  if (!enabled) return;
  Sentry.captureException(error);
}

/**
 * `beforeSend`: request chỉ giữ method và đường dẫn. Query string (tra đơn bằng email),
 * header (cookie phiên, Authorization), body và `user` đều có thể chở dữ liệu khách, mà
 * xem một lỗi 500 thì không cần chúng. Message lỗi validation của Prisma cũng qua lọc
 * (xem `scrubPrismaValidation`).
 */
export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const { user: _user, request, ...rest } = event;
  if (rest.exception?.values) {
    rest.exception = {
      ...rest.exception,
      values: rest.exception.values.map((value) =>
        value.type === 'PrismaClientValidationError' && value.value
          ? { ...value, value: scrubPrismaValidation(value.value) }
          : value,
      ),
    };
  }
  if (!request) return rest;
  return {
    ...rest,
    request: {
      ...(request.method ? { method: request.method } : {}),
      ...(request.url ? { url: request.url.split('?')[0] } : {}),
    },
  };
}

/**
 * Message của `PrismaClientValidationError` in nguyên tham số câu truy vấn (email, tên
 * khách) thành một khối giữa dòng đầu và dòng lý do (đo trên Prisma 7.8, review F1-11).
 * Chỉ giữ đoạn đầu (model và hàm gọi) và đoạn cuối (trường nào sai kiểu gì).
 */
function scrubPrismaValidation(message: string): string {
  const paragraphs = message.trim().split(/\n\s*\n/);
  if (paragraphs.length < 3) return message;
  return `${paragraphs[0]} ${paragraphs.at(-1)}`;
}

/** `beforeBreadcrumb`: bỏ dòng console (log có thể chở email, tên khách), giữ loại khác. */
export function dropConsoleBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  return breadcrumb.category === 'console' ? null : breadcrumb;
}
