import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '../auth/auth.config.js';

/** Hội thoại im quá ngần này ngày thì xoá (ADR-0050 §5, spec P6 §2f). */
export const CHAT_RETENTION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Job dọn hội thoại trợ lý AI (P6): mỗi ngày xoá hội thoại có `updatedAt` cũ hơn
 * `days` ngày — tin xoá theo cascade của FK. `updatedAt` đổi mỗi lượt (giữ lượt và
 * nhả lượt đều ghi lên hội thoại), nên hội thoại còn người dùng không bao giờ bị
 * cắt ngang. Enquiry đã gửi qua chat là bản ghi riêng, có retention riêng (W4 E8),
 * không đi theo hội thoại. Idempotent: lượt sau không còn gì để xoá.
 */
@Injectable()
export class ChatRetentionService {
  private readonly logger = new Logger(ChatRetentionService.name);

  async sweep(now: Date, days = CHAT_RETENTION_DAYS): Promise<number> {
    const cutoff = new Date(now.getTime() - days * DAY_MS);
    const { count } = await prisma.chatConversation.deleteMany({
      where: { updatedAt: { lt: cutoff } },
    });
    if (count > 0) {
      this.logger.log(
        `Chat retention: deleted ${count} conversations idle since before ${cutoff.toISOString().slice(0, 10)} (${days} days)`,
      );
    }
    return count;
  }
}
