import { Logger, Module, type OnModuleInit } from '@nestjs/common';
import { env } from '../../config/env.js';
import { ResendWebhookController } from './resend-webhook.controller.js';

/**
 * Cụm webhook email (W4 E6). Boot KHÔNG bị chặn khi thiếu
 * RESEND_WEBHOOK_SECRET (dev không cần tài khoản Resend) — nhưng phải nói
 * MỘT lần lúc boot để deploy prod thiếu env không hỏng im lặng: endpoint sẽ
 * 503 và bounce/complaint không ai ghi.
 */
@Module({ controllers: [ResendWebhookController] })
export class EmailWebhooksModule implements OnModuleInit {
  private readonly logger = new Logger(EmailWebhooksModule.name);

  onModuleInit(): void {
    if (!env.RESEND_WEBHOOK_SECRET) {
      this.logger.warn(
        'RESEND_WEBHOOK_SECRET chưa set — POST /api/webhooks/resend trả 503, suppression từ Resend KHÔNG được ghi',
      );
    }
  }
}
