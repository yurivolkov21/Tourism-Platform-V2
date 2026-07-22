import { Logger } from '@nestjs/common';
import { env } from '../config/env.js';

const logger = new Logger('Observability');

/**
 * ADR-0010 seam: đẩy một exception 500 lên error-tracker bền.
 *
 * Hiện là SEAM (chưa cài @sentry/node — cần DSN + là dep nặng): thiếu
 * `SENTRY_DSN` → no-op, capture interim là `Logger.error` của exception filter
 * (Render/Railway bắt stdout/stderr, không mất ngay). Khi provision DSN: cài
 * `@sentry/node`, `Sentry.init` một lần lúc boot, rồi thay thân hàm bằng
 * `Sentry.captureException(error)`. Env-gate + call-site giữ nguyên.
 */
export function captureException(error: unknown): void {
  if (!env.SENTRY_DSN) return;
  // TODO(ADR-0010): wire @sentry/node khi có DSN. Tạm cảnh báo để không im lặng.
  logger.warn(
    `SENTRY_DSN set nhưng @sentry/node chưa wire — lỗi chỉ vào log: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
}
