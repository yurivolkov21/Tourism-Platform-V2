import { Controller, UseGuards } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import { AuthGuard } from '../../auth/auth.guard.js';
import { Roles } from '../../auth/roles.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { StatsService } from './stats.service.js';

/**
 * Bề mặt số liệu vùng cho admin (spec P4b §3-F5). Cùng cách ghép guard như
 * AdminBookingsController: `@Roles(ADMIN)` ở cấp class được AuthGuard đọc
 * (getAllAndOverride handler→class), nên ẩn danh → 401, không phải admin →
 * 403 — cả hai TRƯỚC khi oRPC chạm tới bất cứ thứ gì.
 *
 * Bảy handler mỏng đúng nghĩa: không lỗi nghiệp vụ để dịch (contract không
 * khai mã nào — đọc thuần thì không có phán quyết nào để báo). Hai vùng có bộ
 * lọc ngày (`bookings`, `cancellations`) thì có input, và cũng chỉ chuyển
 * tiếp (ADR-0028). Toàn bộ định nghĩa metric
 * nằm ở JSDoc `StatsService`.
 */
@Controller()
@UseGuards(AuthGuard)
@Roles(UserRole.ADMIN)
export class AdminStatsController {
  constructor(private readonly stats: StatsService) {}

  @Implement(contract.admin.stats.bookings)
  bookings() {
    // Endpoint DUY NHẤT của nhóm có input (ADR-0028): khoảng ngày đi thẳng
    // xuống service, không diễn giải gì thêm ở đây — contract đã canh định
    // dạng và luật `from <= to`.
    return implement(contract.admin.stats.bookings).handler(({ input }) =>
      this.stats.adminBookings(input),
    );
  }

  @Implement(contract.admin.stats.cancellations)
  cancellations() {
    return implement(contract.admin.stats.cancellations).handler(({ input }) =>
      this.stats.adminCancellations(input),
    );
  }

  @Implement(contract.admin.stats.reviews)
  reviews() {
    return implement(contract.admin.stats.reviews).handler(() => this.stats.adminReviews());
  }

  @Implement(contract.admin.stats.outbox)
  outbox() {
    return implement(contract.admin.stats.outbox).handler(() => this.stats.adminOutbox());
  }

  @Implement(contract.admin.stats.paymentEvents)
  paymentEvents() {
    return implement(contract.admin.stats.paymentEvents).handler(() =>
      this.stats.adminPaymentEvents(),
    );
  }

  @Implement(contract.admin.stats.enquiries)
  enquiries() {
    return implement(contract.admin.stats.enquiries).handler(() => this.stats.adminEnquiries());
  }

  @Implement(contract.admin.stats.subscribers)
  subscribers() {
    return implement(contract.admin.stats.subscribers).handler(() => this.stats.adminSubscribers());
  }
}
