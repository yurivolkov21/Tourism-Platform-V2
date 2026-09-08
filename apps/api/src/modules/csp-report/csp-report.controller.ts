import { Controller, HttpCode, Logger, Post, type RawBodyRequest, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { Public } from '../../auth/public.decorator.js';
import { corsOrigins, env } from '../../config/env.js';
import { WEBHOOK_THROTTLE } from '../../config/throttle.js';
import {
  CSP_DEDUPE_WINDOW_MS,
  CspReportDeduper,
  hostOf,
  isAllowedDocument,
  parseCspReports,
} from './csp-report.js';

/**
 * Nơi nhận báo cáo CSP của CẢ HAI app (W4 C1, ADR-0038 AMEND 2) — CSP đã
 * enforce từ W3 nhưng không ai biết khi nó chặn; endpoint này là cái tai.
 * Đặt dưới `/api/webhooks/` (hook 415 của W2 ở bootstrap chỉ cho path này
 * ĐÚNG hai MIME `application/csp-report`/`application/reports+json`, mọi
 * content-type khác 415 — vòng vá review W4: `application/json` từng lách
 * trần 8 KB qua parser JSON toàn cục 1 MiB); parser hai MIME đăng ký ở
 * `configureHttp` kèm trần body 8 KB → quá là Fastify 413 trước khi tới đây.
 *
 * Hành vi: chỉ nhận report có `documentUri` thuộc host hai app (report bịa
 * từ host lạ bị bỏ, không log, không chiếm chỗ dedupe); log MỘT dòng cấu
 * trúc mỗi vi phạm, dedupe (app, directive, blockedUri) 10 phút per-process
 * + một dòng tổng kết số report bị nuốt mỗi cửa sổ; trả 204 và KHÔNG gì khác
 * (kể cả body dị dạng); không lưu DB tới khi thấy cần.
 */
@Public()
@Throttle({ default: WEBHOOK_THROTTLE })
@Controller('api/webhooks')
export class CspReportController {
  private readonly logger = new Logger(CspReportController.name);
  private readonly deduper = new CspReportDeduper();
  private lastSummaryAt = Date.now();
  /** Host hai app từ CORS_ORIGINS (⊇ FRONTEND_URL + TRUSTED_ORIGINS, superRefine env.ts). */
  private readonly allowedHosts: ReadonlySet<string> = new Set(
    [...corsOrigins, env.FRONTEND_URL].map(hostOf).filter((h) => h !== ''),
  );

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
      if (!isAllowedDocument(violation, this.allowedHosts)) continue;
      if (!this.deduper.shouldLog(violation)) continue;
      // MỘT dòng cấu trúc — mọi giá trị đã bị parseCspReports cắt trần và
      // bỏ query nên không bơm được chuỗi dài/CRLF/token vào log.
      this.logger.warn(`csp-report ${JSON.stringify(violation)}`);
    }
    this.summarizeIfDue();
  }

  /** Mỗi cửa sổ 10′ một dòng "bị nuốt n" — dedupe không được im lặng tuyệt đối. */
  private summarizeIfDue(now = Date.now()): void {
    if (now - this.lastSummaryAt < CSP_DEDUPE_WINDOW_MS) return;
    this.lastSummaryAt = now;
    const n = this.deduper.drainSuppressed();
    if (n > 0) this.logger.warn(`csp-report-suppressed ${JSON.stringify({ n })}`);
  }
}
