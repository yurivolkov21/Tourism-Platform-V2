import { Module } from '@nestjs/common';
import { AdminStatsController } from './admin-stats.controller.js';
import { StatsService } from './stats.service.js';

/**
 * Module số liệu vùng admin (spec P4b §3-F5). Không import module nào: service
 * chỉ đọc `prisma` trực tiếp (nếp chung của repo — không có PrismaService), và
 * cố ý KHÔNG phụ thuộc BookingsModule/ReviewsModule để aggregate không kéo
 * theo cycle `forwardRef` của money-path.
 *
 * `exports` để P4d nối dashboard vào cùng service này thay vì khai bộ thứ hai.
 */
@Module({
  controllers: [AdminStatsController],
  providers: [StatsService],
  exports: [StatsService],
})
export class StatsModule {}
