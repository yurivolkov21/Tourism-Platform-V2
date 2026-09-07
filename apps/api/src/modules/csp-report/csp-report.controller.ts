import { Controller, HttpCode, Logger, Post, type RawBodyRequest, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { Public } from '../../auth/public.decorator.js';
import { WEBHOOK_THROTTLE } from '../../config/throttle.js';
import { CspReportDeduper, parseCspReports } from './csp-report.js';

/**
 * Nơi nhận báo cáo CSP của CẢ HAI app (W4 C1, ADR-0038 AMEND 2) — CSP đã
 * enforce từ W3 nhưng không ai biết khi nó chặn; endpoint này là cái tai.
 * Đặt dưới `/api/webhooks/` để hook 415 của W2 miễn sẵn (report tới bằng
 * `application/csp-report`/`application/reports+json`, không phải JSON
 * thường); parser content-type cho hai MIME đó đăng ký ở `configureHttp`
 * (bootstrap.ts) kèm trần body 8 KB → quá là Fastify 413 trước khi tới đây.
 *
 * Hành vi: log MỘT dòng cấu trúc mỗi vi phạm, dedupe (directive, blockedUri)
 * 10 phút per-process — một extension phổ biến bị chặn không thành bão log;
 * trả 204 và KHÔNG gì khác (kể cả body dị dạng — non-2xx chỉ mời browser
 * retry, không ai sửa được gì); không lưu DB tới khi thấy cần.
 */
@Public()
@Throttle({ default: WEBHOOK_THROTTLE })
@Controller('api/webhooks')
export class CspReportController {
  private readonly logger = new Logger(CspReportController.name);
  private readonly deduper = new CspReportDeduper();

  @Post('csp-report')
  @HttpCode(204)
  report(@Req() req: RawBodyRequest<FastifyRequest>): void {
    let body: unknown;
    try {
      // Parser của configureHttp cất raw buffer vào req.body cho hai MIME
      // CSP; JSON hỏng → 204 im lặng (xem JSDoc class).
      body = JSON.parse((req.body as Buffer | string | undefined)?.toString() ?? '');
    } catch {
      return;
    }
    for (const violation of parseCspReports(body)) {
      if (!this.deduper.shouldLog(violation)) continue;
      // MỘT dòng cấu trúc — mọi giá trị đã bị parseCspReports cắt trần nên
      // không bơm được chuỗi dài/CRLF vào log.
      this.logger.warn(`csp-report ${JSON.stringify(violation)}`);
    }
  }
}
