import { Controller } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import { Roles } from '../../auth/roles.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { toContractError } from '../../lib/contract-error.js';
import { AdminDestinationsService } from './admin-destinations.service.js';

/**
 * Bề mặt điểm đến cho admin (spec P4e-2 F15). Cùng cách ghép guard như
 * `AdminCategoriesController`: `@Roles(ADMIN)` ở cấp class được AuthGuard đọc —
 * ẩn danh → 401, không phải admin → 403, cả hai TRƯỚC khi oRPC parse input.
 *
 * Lỗi service → lỗi contract đi qua `toContractError` dùng chung (nợ G3): lỗi
 * của vùng này mang sẵn mã, nên không có nhánh `instanceof` riêng nào ở đây.
 */
@Controller()
@Roles(UserRole.ADMIN)
export class AdminDestinationsController {
  constructor(private readonly destinations: AdminDestinationsService) {}

  @Implement(contract.admin.destinations.list)
  list() {
    return implement(contract.admin.destinations.list).handler(() => this.destinations.list());
  }

  @Implement(contract.admin.destinations.create)
  create() {
    return implement(contract.admin.destinations.create).handler(async ({ input, errors }) => {
      try {
        return await this.destinations.create(input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }

  @Implement(contract.admin.destinations.update)
  update() {
    return implement(contract.admin.destinations.update).handler(async ({ input, errors }) => {
      try {
        return await this.destinations.update(input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }

  @Implement(contract.admin.destinations.setActive)
  setActive() {
    return implement(contract.admin.destinations.setActive).handler(async ({ input, errors }) => {
      try {
        return await this.destinations.setActive(input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }
}
