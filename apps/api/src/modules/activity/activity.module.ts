import { Module } from '@nestjs/common';
import { ActivityService } from './activity.service.js';
import { AdminActivityController } from './admin-activity.controller.js';

/**
 * Nhật ký thao tác admin (ADR-0061) — chỉ phần đọc và ghi lượt xuất. Phần ghi sau mỗi lệnh ghi
 * admin không cần module: `@AdminImplement` gắn interceptor dựng bằng `new`, ghi qua `prisma`
 * dùng chung, nên module của từng controller không phải import gì thêm.
 */
@Module({
  controllers: [AdminActivityController],
  providers: [ActivityService],
})
export class ActivityModule {}
