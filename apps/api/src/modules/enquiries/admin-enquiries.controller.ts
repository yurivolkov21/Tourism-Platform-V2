import { Controller } from '@nestjs/common';
import { implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import { AdminImplement } from '../../auth/admin-implement.decorator.js';
import type { SessionUser } from '../../auth/auth.config.js';
import { CurrentUser } from '../../auth/current-user.decorator.js';
import { Roles } from '../../auth/roles.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { AdminEnquiriesService, EnquiryNotFoundError } from './admin-enquiries.service.js';

/**
 * Bề mặt enquiries cho admin (spec P4c §3-F9). Cùng cách ghép guard như
 * AdminOutboxController: `@Roles(ADMIN)` cấp class là lưới; quyền thật của từng handler do
 * `@AdminImplement` suy từ bảng `ADMIN_ACCESS` (ADR-0052) — ẩn danh → 401, khách → 403,
 * Staff → 403 ở thủ tục chỉ Owner, cả hai TRƯỚC khi oRPC parse input (nên
 * một request không quyền không bao giờ chạm tới bảng, kể cả để đọc).
 *
 * Hai handler GHI lấy danh tính từ `@CurrentUser()` chứ không từ input: ai
 * đổi trạng thái / viết note là chuyện của PHIÊN, không phải của body.
 */
@Controller()
@Roles(UserRole.ADMIN)
export class AdminEnquiriesController {
  constructor(private readonly enquiries: AdminEnquiriesService) {}

  @AdminImplement(contract.admin.enquiries.list)
  list() {
    return implement(contract.admin.enquiries.list).handler(({ input }) =>
      this.enquiries.list(input),
    );
  }

  @AdminImplement(contract.admin.enquiries.byId)
  byId() {
    return implement(contract.admin.enquiries.byId).handler(async ({ input, errors }) => {
      try {
        return await this.enquiries.byId(input.id);
      } catch (error) {
        if (error instanceof EnquiryNotFoundError) throw errors.NOT_FOUND();
        throw error;
      }
    });
  }

  @AdminImplement(contract.admin.enquiries.setStatus)
  setStatus(@CurrentUser() user: SessionUser) {
    return implement(contract.admin.enquiries.setStatus).handler(async ({ input, errors }) => {
      try {
        return await this.enquiries.setStatus({ id: user.id }, input);
      } catch (error) {
        if (error instanceof EnquiryNotFoundError) throw errors.NOT_FOUND();
        throw error;
      }
    });
  }

  @AdminImplement(contract.admin.enquiries.addNote)
  addNote(@CurrentUser() user: SessionUser) {
    return implement(contract.admin.enquiries.addNote).handler(async ({ input, errors }) => {
      try {
        return await this.enquiries.addNote(
          { id: user.id, name: user.name, email: user.email },
          input,
        );
      } catch (error) {
        if (error instanceof EnquiryNotFoundError) throw errors.NOT_FOUND();
        throw error;
      }
    });
  }
}
