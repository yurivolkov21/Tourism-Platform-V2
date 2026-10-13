import { Controller } from '@nestjs/common';
import { implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import { AdminImplement } from '../../auth/admin-implement.decorator.js';
import type { SessionUser } from '../../auth/auth.config.js';
import { CurrentUser } from '../../auth/current-user.decorator.js';
import { Roles } from '../../auth/roles.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { toContractError } from '../../lib/contract-error.js';
import { AdminUsersService } from './admin-users.service.js';

/**
 * Vùng Users (P4f, ADR-0052). Sáu thủ tục đều `owner` trong `ADMIN_ACCESS` — `@AdminImplement`
 * suy `@Roles(ADMIN)` từ bảng; `@Roles(ADMIN)` cấp class là lưới như mọi controller admin.
 * Người làm lấy từ PHIÊN (`@CurrentUser`), không bao giờ từ input.
 */
@Controller()
@Roles(UserRole.ADMIN)
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @AdminImplement(contract.admin.users.list)
  list() {
    return implement(contract.admin.users.list).handler(({ input }) => this.users.list(input));
  }

  @AdminImplement(contract.admin.users.byId)
  byId() {
    return implement(contract.admin.users.byId).handler(async ({ input, errors }) => {
      try {
        return await this.users.byId(input.id);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }

  @AdminImplement(contract.admin.users.setRole)
  setRole(@CurrentUser() user: SessionUser) {
    return implement(contract.admin.users.setRole).handler(async ({ input, errors }) => {
      try {
        return await this.users.setRole({ id: user.id }, input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }

  @AdminImplement(contract.admin.users.lock)
  lock(@CurrentUser() user: SessionUser) {
    return implement(contract.admin.users.lock).handler(async ({ input, errors }) => {
      try {
        return await this.users.lock({ id: user.id }, input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }

  @AdminImplement(contract.admin.users.unlock)
  unlock(@CurrentUser() user: SessionUser) {
    return implement(contract.admin.users.unlock).handler(async ({ input, errors }) => {
      try {
        return await this.users.unlock({ id: user.id }, input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }

  @AdminImplement(contract.admin.users.revokeSessions)
  revokeSessions(@CurrentUser() user: SessionUser) {
    return implement(contract.admin.users.revokeSessions).handler(async ({ input, errors }) => {
      try {
        return await this.users.revokeSessions({ id: user.id }, input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }
}
