import { Controller } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import { Roles } from '../../auth/roles.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { toContractError } from '../../lib/contract-error.js';
import { AdminCategoriesService } from './admin-categories.service.js';

/**
 * Bề mặt danh mục tour cho admin (spec P4e-2 F14). Cùng cách ghép guard như
 * `AdminDeparturesController`: `@Roles(ADMIN)` ở cấp class được AuthGuard đọc —
 * ẩn danh → 401, không phải admin → 403, cả hai TRƯỚC khi oRPC parse input.
 *
 * Lỗi service → lỗi contract đi qua `toContractError` dùng chung (nợ G3, rút
 * ở F15 khi bản thứ ba sắp ra đời): ba lỗi của vùng mang sẵn mã, nên không còn
 * ba nhánh `instanceof` riêng ở đây.
 */
@Controller()
@Roles(UserRole.ADMIN)
export class AdminCategoriesController {
  constructor(private readonly categories: AdminCategoriesService) {}

  @Implement(contract.admin.categories.list)
  list() {
    return implement(contract.admin.categories.list).handler(() => this.categories.list());
  }

  @Implement(contract.admin.categories.create)
  create() {
    return implement(contract.admin.categories.create).handler(async ({ input, errors }) => {
      try {
        return await this.categories.create(input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }

  @Implement(contract.admin.categories.update)
  update() {
    return implement(contract.admin.categories.update).handler(async ({ input, errors }) => {
      try {
        return await this.categories.update(input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }

  @Implement(contract.admin.categories.setActive)
  setActive() {
    return implement(contract.admin.categories.setActive).handler(async ({ input, errors }) => {
      try {
        return await this.categories.setActive(input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }

  @Implement(contract.admin.categories.move)
  move() {
    return implement(contract.admin.categories.move).handler(async ({ input, errors }) => {
      try {
        return await this.categories.move(input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }
}
