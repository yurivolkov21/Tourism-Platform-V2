import { Module } from '@nestjs/common';
import { AdminReportsController } from './admin-reports.controller.js';
import { AdminStatsController } from './admin-stats.controller.js';
import { ReportsService } from './reports.service.js';
import { StatsService } from './stats.service.js';

/**
 * Module số liệu vùng admin (spec P4b §3-F5). Không import module nào: service
 * chỉ đọc `prisma` trực tiếp (nếp chung của repo — không có PrismaService), và
 * cố ý KHÔNG phụ thuộc BookingsModule/ReviewsModule để aggregate không kéo
 * theo cycle `forwardRef` của money-path.
 *
 * `exports` để P4d nối dashboard vào cùng service này thay vì khai bộ thứ hai.
 *
 * F6 thêm `ReportsService` + controller báo cáo tháng vào ĐÂY chứ không mở
 * module mới: hai bề mặt dùng chung một bộ câu aggregate (`stats-aggregates.ts`)
 * và cùng một khái niệm "đọc thuần, không bất biến ghi nào để canh".
 */
@Module({
  controllers: [AdminStatsController, AdminReportsController],
  providers: [StatsService, ReportsService],
  exports: [StatsService, ReportsService],
})
export class StatsModule {}
