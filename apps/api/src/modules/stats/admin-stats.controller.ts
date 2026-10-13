import { Controller } from '@nestjs/common';
import { implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import { AdminImplement } from '../../auth/admin-implement.decorator.js';
import { Roles } from '../../auth/roles.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { StatsService } from './stats.service.js';

/**
 * Bề mặt số liệu vùng cho admin (spec P4b §3-F5). Cùng cách ghép guard như
 * AdminBookingsController: `@Roles(ADMIN)` cấp class là lưới; quyền thật của từng handler do
 * `@AdminImplement` suy từ bảng `ADMIN_ACCESS` (ADR-0052) — ẩn danh → 401, khách → 403,
 * Staff → 403 ở thủ tục chỉ Owner — cả hai TRƯỚC khi oRPC chạm tới bất cứ
 * thứ gì.
 *
 * Bảy handler mỏng đúng nghĩa: không lỗi nghiệp vụ để dịch (contract không
 * khai mã nào — đọc thuần thì không có phán quyết nào để báo). Hai vùng có bộ
 * lọc ngày (`bookings`, `reviews`) thì có input, và cũng chỉ chuyển tiếp
 * (ADR-0028 + AMEND 2); `dashboard` nhận `?days=` (ADR-0036).
 * Toàn bộ định nghĩa metric nằm ở JSDoc `StatsService`.
 */
@Controller()
@Roles(UserRole.ADMIN)
export class AdminStatsController {
  constructor(private readonly stats: StatsService) {}

  @AdminImplement(contract.admin.stats.bookings)
  bookings() {
    // Khoảng ngày đi thẳng xuống service, không diễn giải gì thêm ở đây —
    // contract đã canh định dạng và luật `from <= to` (ADR-0028).
    return implement(contract.admin.stats.bookings).handler(({ input }) =>
      this.stats.adminBookings(input),
    );
  }

  @AdminImplement(contract.admin.stats.reviews)
  reviews() {
    return implement(contract.admin.stats.reviews).handler(({ input }) =>
      this.stats.adminReviews(input),
    );
  }

  @AdminImplement(contract.admin.stats.outbox)
  outbox() {
    return implement(contract.admin.stats.outbox).handler(() => this.stats.adminOutbox());
  }

  @AdminImplement(contract.admin.stats.paymentEvents)
  paymentEvents() {
    return implement(contract.admin.stats.paymentEvents).handler(() =>
      this.stats.adminPaymentEvents(),
    );
  }

  @AdminImplement(contract.admin.stats.enquiries)
  enquiries() {
    return implement(contract.admin.stats.enquiries).handler(() => this.stats.adminEnquiries());
  }

  @AdminImplement(contract.admin.stats.subscribers)
  subscribers() {
    return implement(contract.admin.stats.subscribers).handler(() => this.stats.adminSubscribers());
  }

  @AdminImplement(contract.admin.stats.dashboard)
  dashboard() {
    // `days` đã qua literal 7|30|90 (+ mặc định 90) của contract; smart
    // coercion đã ép chuỗi query string thành số trước khi tới đây.
    return implement(contract.admin.stats.dashboard).handler(({ input }) =>
      this.stats.adminDashboard(input),
    );
  }
}
