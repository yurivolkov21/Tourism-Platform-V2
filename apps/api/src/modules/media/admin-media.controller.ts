import { Controller } from '@nestjs/common';
import { implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import { AdminImplement } from '../../auth/admin-implement.decorator.js';
import { Roles } from '../../auth/roles.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { toContractError } from '../../lib/contract-error.js';
import { AdminMediaService } from './admin-media.service.js';

/**
 * Bề mặt Media library cho admin (ADR-0060). Controller RIÊNG, không đắp vào `MediaController`:
 * cái kia là đường ký upload của khách, mang trần throttle của khách.
 *
 * Ẩn danh → 401, không phải admin → 403, cả hai trước khi oRPC parse input. Bậc Staff hay
 * Owner đọc từ `ADMIN_ACCESS` qua `@AdminImplement`.
 */
@Controller()
@Roles(UserRole.ADMIN)
export class AdminMediaController {
  constructor(private readonly media: AdminMediaService) {}

  @AdminImplement(contract.admin.media.list)
  list() {
    return implement(contract.admin.media.list).handler(() => this.media.list());
  }

  @AdminImplement(contract.admin.media.update)
  update() {
    return implement(contract.admin.media.update).handler(async ({ input, errors }) => {
      try {
        return await this.media.update(input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }

  @AdminImplement(contract.admin.media.queue)
  queue() {
    return implement(contract.admin.media.queue).handler(() => this.media.queue());
  }
}
