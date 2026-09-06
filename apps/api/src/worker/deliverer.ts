import { Injectable, Logger } from '@nestjs/common';
import type { EmailType } from '../generated/prisma/enums.js';
import { redactDeep } from '../lib/redact.js';

/**
 * Cổng giao email cho outbox drain (ADR-0007). P1 chỉ có ConsoleDeliverer
 * (log-deliver, luôn thành công); P2 thay bằng ResendDeliverer (render
 * template + gọi Resend API) qua cùng token — OutboxService không đổi.
 */
export interface EmailDeliverer {
  deliver(type: EmailType, payload: unknown): Promise<void>;
}

/** Injection token cho {@link EmailDeliverer} (interface không tồn tại lúc runtime). */
export const EMAIL_DELIVERER = Symbol('EMAIL_DELIVERER');

/** P1 skeleton: "gửi" = log ra stdout, không bao giờ throw. */
@Injectable()
export class ConsoleDeliverer implements EmailDeliverer {
  private readonly logger = new Logger(ConsoleDeliverer.name);

  async deliver(type: EmailType, payload: unknown): Promise<void> {
    // W2 mục 6: payload mang url reset (token) + otp — che trước khi ra
    // stdout, cùng máy redactDeep của bề mặt admin. Email nhận vẫn hiện
    // (dev cần biết "gửi cho ai"), credential thì không.
    this.logger.log(`deliver ${type}: ${JSON.stringify(redactDeep(payload))}`);
  }
}
