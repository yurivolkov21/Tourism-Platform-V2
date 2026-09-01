import { Controller, UseGuards } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import { AuthGuard } from '../../auth/auth.guard.js';
import { Roles } from '../../auth/roles.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { ReportsService } from './reports.service.js';

/**
 * Bề mặt báo cáo tháng cho admin (spec P4b §3-F6). Cùng cách ghép guard như
 * `AdminStatsController`: `@Roles(ADMIN)` ở cấp class được AuthGuard đọc
 * (getAllAndOverride handler→class), nên ẩn danh → 401, không phải admin →
 * 403 — cả hai TRƯỚC khi oRPC chạm tới bất cứ thứ gì.
 *
 * Handler mỏng: `month` đã được contract canh định dạng, và đọc thuần thì
 * không có phán quyết nghiệp vụ nào để dịch thành lỗi (tháng trống là một báo
 * cáo toàn số 0, không phải 404).
 */
@Controller()
@UseGuards(AuthGuard)
@Roles(UserRole.ADMIN)
export class AdminReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Implement(contract.admin.reports.monthly)
  monthly() {
    return implement(contract.admin.reports.monthly).handler(({ input }) =>
      this.reports.monthly(input.month),
    );
  }
}
