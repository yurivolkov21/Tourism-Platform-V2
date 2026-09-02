import { Module } from '@nestjs/common';
import { AdminOutboxController } from './admin-outbox.controller.js';
import { AdminOutboxService } from './admin-outbox.service.js';

/**
 * Module vùng outbox cho admin (spec P4c §3-F7, §2.1: mỗi vùng một module).
 *
 * CỐ Ý không import `WorkerModule`: retry chỉ đặt lại trạng thái row bằng
 * Prisma, việc gửi lại là của lượt drain kế (pg-boss, mỗi phút). Kéo
 * `OutboxService` của worker vào đây là mời API gọi `drainOnce()` — đúng thứ
 * spec cấm (worker và API là hai vòng đời khác nhau, ADR-0007/0024).
 */
@Module({
  controllers: [AdminOutboxController],
  providers: [AdminOutboxService],
})
export class OutboxModule {}
