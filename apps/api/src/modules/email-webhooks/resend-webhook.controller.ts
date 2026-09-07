import {
  BadRequestException,
  Controller,
  HttpCode,
  Logger,
  Post,
  type RawBodyRequest,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { FastifyRequest } from 'fastify';
import { prisma } from '../../auth/auth.config.js';
import { Public } from '../../auth/public.decorator.js';
import { env } from '../../config/env.js';
import { WEBHOOK_THROTTLE } from '../../config/throttle.js';
import { suppressionsFromResendEvent } from './resend-event.js';
import { verifySvixSignature } from './svix.js';

/**
 * Webhook Resend (W4 E6, ADR-0039 §4): nguồn sự thật THỨ HAI về consent —
 * bounce cứng/complaint → upsert `email_suppressions`, drain SKIP mọi row
 * gửi tới đó. Route Nest THUẦN dưới `/api/webhooks/` cùng lý do với
 * webhooks.controller.ts của payments: bên gọi là server Resend (không phải
 * contract client) và verify svix cần RAW bytes (`rawBody: true` đã bật từ
 * P2 cho Stripe); path này cũng được hook 415 của W2 miễn sẵn.
 *
 * Status contract (cùng luật payments): chữ ký sai → 400 mã cố định; event
 * hợp lệ nhưng không thuộc loại ta ghi → vẫn 200 (với provider, non-2xx là
 * lệnh redeliver — retry một event ta cố ý bỏ qua là vô nghĩa).
 */
@Public()
@Throttle({ default: WEBHOOK_THROTTLE })
@Controller('api/webhooks')
export class ResendWebhookController {
  private readonly logger = new Logger(ResendWebhookController.name);

  @Post('resend')
  @HttpCode(200)
  async resend(@Req() req: RawBodyRequest<FastifyRequest>) {
    // Đọc env LƯỜI theo request (không chụp ở constructor): thiếu secret →
    // 503 "chưa cấu hình" chứ KHÔNG chặn boot — dev không cần tài khoản
    // Resend; một dòng log lúc boot do module lo (onModuleInit).
    const secret = env.RESEND_WEBHOOK_SECRET;
    if (!secret) {
      throw new ServiceUnavailableException({
        code: 'WEBHOOK_NOT_CONFIGURED',
        message: 'Resend webhook is not configured',
      });
    }

    const payload = (req.rawBody ?? Buffer.alloc(0)).toString('utf8');
    const valid = verifySvixSignature({
      secret,
      id: String(req.headers['svix-id'] ?? ''),
      timestamp: String(req.headers['svix-timestamp'] ?? ''),
      signatureHeader: String(req.headers['svix-signature'] ?? ''),
      payload,
    });
    if (!valid) {
      // Mã CỐ ĐỊNH như payments W1: chi tiết chỉ vào log, không phát miễn
      // phí cho kẻ dò biết fail ở bước nào.
      this.logger.warn('Rejected Resend webhook (signature invalid)');
      throw new BadRequestException({
        code: 'WEBHOOK_SIGNATURE_INVALID',
        message: 'Webhook rejected',
      });
    }

    let body: unknown;
    try {
      body = JSON.parse(payload);
    } catch {
      // Chữ ký đúng mà body không phải JSON là chuyện không xảy ra với
      // Resend thật — vẫn 400 thay vì 500 để không mời redeliver vĩnh viễn.
      throw new BadRequestException({ code: 'WEBHOOK_BODY_INVALID', message: 'Webhook rejected' });
    }

    const suppressions = suppressionsFromResendEvent(body);
    for (const { email, reason } of suppressions) {
      // `update: {}` — GIỮ bản ghi đầu (mốc + lý do đầu tiên là bằng chứng);
      // suppression không tự xoá, operator gỡ tay khi khách xác nhận địa chỉ
      // sống lại (ADR-0039 §4).
      await prisma.emailSuppression.upsert({
        where: { email },
        create: { email, reason, source: 'resend' },
        update: {},
      });
      this.logger.warn(`email suppression ghi: reason=${reason} (resend webhook)`);
    }
    return { received: true as const, suppressed: suppressions.length };
  }
}
