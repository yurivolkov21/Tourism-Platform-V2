import { Injectable, Logger } from '@nestjs/common';
import { env } from '../config/env.js';
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

/**
 * P1 skeleton: "gửi" = log ra stdout, không bao giờ throw.
 *
 * Che credential (W2 mục 6) TRỪ ở `development` (vòng vá review W2): máy dev
 * không có RESEND_API_KEY thì dòng log này là đường DUY NHẤT lấy OTP/link
 * reset — che ở đó là dev mới clone repo không đăng nhập được local. Ngoài
 * dev (prod lỡ thiếu key, test) vẫn che.
 */
@Injectable()
export class ConsoleDeliverer implements EmailDeliverer {
  private readonly logger = new Logger(ConsoleDeliverer.name);

  constructor(private readonly redact: boolean = env.NODE_ENV !== 'development') {}

  async deliver(type: EmailType, payload: unknown): Promise<void> {
    const shown = this.redact ? redactDeep(payload) : payload;
    this.logger.log(`deliver ${type}: ${JSON.stringify(shown)}`);
  }
}
