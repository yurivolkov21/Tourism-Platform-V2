import { Injectable, Logger } from '@nestjs/common';
import { prisma } from '../auth/auth.config.js';
import { anonymizeEnquiriesOlderThan, retentionCutoff } from '../lib/enquiry-anonymize.js';

/**
 * Job retention enquiry (W4 E8, ADR-0039 §6): mỗi ngày anonymize enquiry có
 * `createdAt` quá `ENQUIRY_RETENTION_MONTHS` — chạy trong vòng pg-boss của
 * worker (start-worker.ts), cùng khuôn outbox-purge/media-gc. Idempotent:
 * guard `anonymized_at IS NULL` trong câu UPDATE nên chạy lại không đụng
 * row đã xử lý.
 */
@Injectable()
export class EnquiryRetentionService {
  private readonly logger = new Logger(EnquiryRetentionService.name);

  async sweep(now: Date, retentionMonths: number): Promise<number> {
    const cutoff = retentionCutoff(now, retentionMonths);
    const count = await anonymizeEnquiriesOlderThan(prisma, cutoff);
    if (count > 0) {
      this.logger.log(
        `Enquiry retention: anonymized ${count} enquiries older than ${cutoff.toISOString().slice(0, 10)} (${retentionMonths} months)`,
      );
    }
    return count;
  }
}
