import { Controller } from '@nestjs/common';
import { implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import { AdminImplement } from '../../auth/admin-implement.decorator.js';
import type { SessionUser } from '../../auth/auth.config.js';
import { CurrentUser } from '../../auth/current-user.decorator.js';
import { Roles } from '../../auth/roles.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { toContractError } from '../../lib/contract-error.js';
import { AdminDeparturesService } from './admin-departures.service.js';
import { DepartureCancelService } from './departure-cancel.service.js';

/**
 * Bề mặt chuyến khởi hành cho admin (spec P4e-1 F12). Cùng cách ghép guard
 * như `AdminEnquiriesController`: `@Roles(ADMIN)` cấp class là lưới; quyền thật của từng handler do
 * `@AdminImplement` suy từ bảng `ADMIN_ACCESS` (ADR-0052) — ẩn danh → 401, khách → 403,
 * Staff → 403 ở thủ tục chỉ Owner, cả hai TRƯỚC khi oRPC parse
 * input, nên một request không quyền không bao giờ chạm tới bảng.
 *
 * Ba lệnh ghi không nhận danh tính admin qua input và cũng chưa ghi audit
 * row: chuyến không có sổ lịch sử riêng (khác enquiry), còn thứ đổi tiền thì
 * nằm ở đường huỷ của F13. Dấu vết hiện tại là dòng log của service.
 *
 * Lỗi service → lỗi contract đi qua `toContractError` dùng chung (nợ G3): lỗi của vùng này
 * (`admin-departure-errors.ts`) mang sẵn mã, nên không còn nhánh `instanceof` riêng nào ở đây.
 * `NOT_FOUND` của `list`/`create` nói về tour, của ba lệnh ghi nói về chuyến — mỗi procedure
 * một câu, khai ngay trong contract.
 */
@Controller()
@Roles(UserRole.ADMIN)
export class AdminDeparturesController {
  constructor(
    private readonly departures: AdminDeparturesService,
    private readonly departureCancel: DepartureCancelService,
  ) {}

  @AdminImplement(contract.admin.departures.list)
  list() {
    return implement(contract.admin.departures.list).handler(async ({ input, errors }) => {
      try {
        return await this.departures.list(input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }

  @AdminImplement(contract.admin.departures.create)
  create() {
    return implement(contract.admin.departures.create).handler(async ({ input, errors }) => {
      try {
        return await this.departures.create(input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }

  @AdminImplement(contract.admin.departures.update)
  update() {
    return implement(contract.admin.departures.update).handler(async ({ input, errors }) => {
      try {
        return await this.departures.update(input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }

  /**
   * CÔNG TY huỷ chuyến (F13) — lệnh ghi duy nhất của vùng này cần danh tính
   * admin: nó ghi `cancellation_requests.decided_by` cho từng khách, và đó là
   * chỗ duy nhất còn lại khi ai đó mở sổ ra hỏi ai đã quyết.
   */
  @AdminImplement(contract.admin.departures.cancel)
  cancel(@CurrentUser() user: SessionUser) {
    return implement(contract.admin.departures.cancel).handler(async ({ input, errors }) => {
      try {
        return await this.departureCancel.cancel(input, user.id);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }

  @AdminImplement(contract.admin.departures.setStatus)
  setStatus() {
    return implement(contract.admin.departures.setStatus).handler(async ({ input, errors }) => {
      try {
        return await this.departures.setStatus(input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }
}
