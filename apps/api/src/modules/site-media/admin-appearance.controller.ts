import { Controller } from '@nestjs/common';
import { implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import { AdminImplement } from '../../auth/admin-implement.decorator.js';
import { Roles } from '../../auth/roles.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { toContractError } from '../../lib/contract-error.js';
import { AppearanceService } from './appearance.service.js';

/**
 * Bề mặt Appearance cho admin (ADR-0059). Controller RIÊNG, không đắp vào
 * `SiteMediaController`: cái kia là `@Public()` và cache công khai — một route admin sống
 * trong đó sẽ thừa hưởng cả hai.
 *
 * Ẩn danh → 401, không phải admin → 403, cả hai trước khi oRPC parse input. Bậc Staff hay
 * Owner đọc từ `ADMIN_ACCESS` qua `@AdminImplement`.
 */
@Controller()
@Roles(UserRole.ADMIN)
export class AdminAppearanceController {
  constructor(private readonly appearance: AppearanceService) {}

  @AdminImplement(contract.admin.appearance.list)
  list() {
    return implement(contract.admin.appearance.list).handler(() => this.appearance.list());
  }

  @AdminImplement(contract.admin.appearance.signUpload)
  signUpload() {
    return implement(contract.admin.appearance.signUpload).handler(async ({ input, errors }) => {
      try {
        return await this.appearance.signUpload(input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }

  @AdminImplement(contract.admin.appearance.setSlot)
  setSlot() {
    return implement(contract.admin.appearance.setSlot).handler(async ({ input, errors }) => {
      try {
        return await this.appearance.setSlot(input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }
}
