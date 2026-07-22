import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { captureException } from './observability.js';

/** HTTP status → mã lỗi chữ (envelope oRPC dùng `code` chuỗi, không phải số). */
const STATUS_CODE: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_SERVER_ERROR',
  502: 'BAD_GATEWAY',
  503: 'SERVICE_UNAVAILABLE',
};

function statusToCode(status: number): string {
  return STATUS_CODE[status] ?? `HTTP_${status}`;
}

/** Envelope lỗi thống nhất — khớp shape mà oRPC procedure-error trả về. */
interface ErrorEnvelope {
  defined: false;
  code: string;
  status: number;
  message: string;
  data: null;
}

/**
 * ADR-0010: chuẩn hoá MỌI lỗi rơi vào pipeline Nest về đúng envelope oRPC
 * `{ defined, code, status, message, data }` — FE có MỘT parser cho mọi nguồn.
 *
 * Chỉ thấy: exception từ **guard** (401/403 trên mọi route), route **Nest thuần**
 * (account/webhooks/health), và **lỗi bất ngờ**. Procedure-error của oRPC tự
 * format response TRƯỚC khi tới đây nên KHÔNG bị đụng (giữ nguyên `{code:'…'}`).
 *
 * Lỗi bất ngờ (không phải HttpException) → 500 **ẩn stack/chi tiết** (không leak),
 * log + đẩy Sentry seam.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const reply = host.switchToHttp().getResponse<FastifyReply>();
    const envelope = this.toEnvelope(exception);
    reply.status(envelope.status).send(envelope);
  }

  private toEnvelope(exception: unknown): ErrorEnvelope {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const obj =
        typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : null;
      // Body object mang `code` (webhook tự đặt) → giữ nguyên; guard 401/403 chỉ
      // có `message`/`statusCode` → suy `code` từ status.
      const code = obj && typeof obj.code === 'string' ? obj.code : statusToCode(status);
      const message =
        obj && typeof obj.message === 'string'
          ? obj.message
          : typeof body === 'string'
            ? body
            : exception.message;
      return { defined: false, code, status, message, data: null };
    }

    // Lỗi ngoài dự kiến → 500 ẩn chi tiết (không leak stack ra client), log đầy
    // đủ ở server + đẩy Sentry seam (bền hơn console).
    this.logger.error(
      `Unhandled exception: ${
        exception instanceof Error ? (exception.stack ?? exception.message) : String(exception)
      }`,
    );
    captureException(exception);
    return {
      defined: false,
      code: 'INTERNAL_SERVER_ERROR',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
      data: null,
    };
  }
}
