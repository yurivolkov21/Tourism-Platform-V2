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
 * Lỗi giao email MANG status HTTP của provider (W4 E5, ADR-0039 §4) — drain
 * đọc `status` để phân loại: 4xx (trừ 429) là vĩnh viễn, còn lại là tạm.
 * Deliverer nào gọi HTTP thì ném lớp này thay Error trần; lỗi mạng (fetch
 * ném trước khi có response) vẫn là Error thường → mặc định coi là tạm.
 */
export class DeliveryHttpError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'DeliveryHttpError';
  }
}

/**
 * Status 4xx vẫn coi là TẠM (vòng vá review W4): 401/403 là CREDENTIAL của
 * TA hỏng (xoay RESEND_API_KEY, key bị thu hồi) — lỗi đó ở ta chứ không ở
 * thư, sửa env xong là cả batch phải đi tiếp; park FAILED thì mỗi row phải
 * retry tay từng id. 408 là timeout phía provider, cùng bản chất với 5xx.
 */
const TEMPORARY_4XX: ReadonlySet<number> = new Set([401, 403, 408, 429]);

/**
 * Lỗi VĨNH VIỄN — gửi lại y nguyên chỉ ra y kết quả (thư sai địa chỉ,
 * payload hỏng): 4xx trừ {@link TEMPORARY_4XX}. Mọi thứ khác (429, 5xx, lỗi
 * mạng, Error trần) là TẠM — giữ đường retry với backoff.
 */
export function isPermanentDeliveryError(err: unknown): boolean {
  return (
    err instanceof DeliveryHttpError &&
    err.status >= 400 &&
    err.status < 500 &&
    !TEMPORARY_4XX.has(err.status)
  );
}

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

  /** Test đổi được; KHÔNG là tham số constructor — Nest DI sẽ đòi inject `Boolean`. */
  redact: boolean = env.NODE_ENV !== 'development';

  async deliver(type: EmailType, payload: unknown): Promise<void> {
    const shown = this.redact ? redactDeep(payload) : payload;
    this.logger.log(`deliver ${type}: ${JSON.stringify(shown)}`);
  }
}
