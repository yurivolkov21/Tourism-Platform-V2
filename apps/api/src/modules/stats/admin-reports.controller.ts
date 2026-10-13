import { Controller } from '@nestjs/common';
import { implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import { AdminImplement } from '../../auth/admin-implement.decorator.js';
import { Roles } from '../../auth/roles.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { ReportsService } from './reports.service.js';

/**
 * Bề mặt báo cáo tháng cho admin (spec P4b §3-F6). Cùng cách ghép guard như
 * `AdminStatsController`: `@Roles(ADMIN)` cấp class là lưới; quyền thật của từng handler do
 * `@AdminImplement` suy từ bảng `ADMIN_ACCESS` (ADR-0052) — ẩn danh → 401, khách → 403,
 * Staff → 403 ở thủ tục chỉ Owner — cả hai TRƯỚC khi oRPC chạm tới bất cứ
 * thứ gì.
 *
 * Handler mỏng: `month` đã được contract canh định dạng, và đọc thuần thì
 * không có phán quyết nghiệp vụ nào để dịch thành lỗi (tháng trống là một báo
 * cáo toàn số 0, không phải 404).
 */
@Controller()
@Roles(UserRole.ADMIN)
export class AdminReportsController {
  constructor(private readonly reports: ReportsService) {}

  @AdminImplement(contract.admin.reports.monthly)
  monthly() {
    return implement(contract.admin.reports.monthly).handler(({ input }) =>
      this.reports.monthly(input.month),
    );
  }
}
