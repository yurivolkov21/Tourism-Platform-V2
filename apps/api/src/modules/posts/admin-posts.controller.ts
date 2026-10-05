import { Controller } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import type { SessionUser } from '../../auth/auth.config.js';
import { CurrentUser } from '../../auth/current-user.decorator.js';
import { Roles } from '../../auth/roles.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { toContractError } from '../../lib/contract-error.js';
import { RelatedTourNotFoundError } from './admin-post-errors.js';
import { AdminPostsService } from './admin-posts.service.js';

/**
 * Bề mặt bài viết cho admin (spec P4e-4 §3). Controller RIÊNG, không đắp vào
 * `PostsController`: cái kia là đọc công khai cache được — một route admin sống trong đó
 * có thể bị cache công khai, rò bài nháp qua proxy.
 *
 * Ẩn danh → 401, không phải admin → 403, cả hai trước khi oRPC parse input. Trần ghi
 * của ADR-0037 tự áp cho route ghi có session admin.
 */
@Controller()
@Roles(UserRole.ADMIN)
export class AdminPostsController {
  constructor(private readonly posts: AdminPostsService) {}

  @Implement(contract.admin.posts.list)
  list() {
    return implement(contract.admin.posts.list).handler(({ input }) => this.posts.list(input));
  }

  @Implement(contract.admin.posts.get)
  get() {
    return implement(contract.admin.posts.get).handler(async ({ input, errors }) => {
      try {
        return await this.posts.get(input.slug);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }

  @Implement(contract.admin.posts.create)
  create(@CurrentUser() user: SessionUser) {
    return implement(contract.admin.posts.create).handler(async ({ input, errors }) => {
      try {
        return await this.posts.create(input, user.id);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }

  @Implement(contract.admin.posts.update)
  update() {
    return implement(contract.admin.posts.update).handler(async ({ input, errors }) => {
      try {
        return await this.posts.update(input);
      } catch (error) {
        // Mã DUY NHẤT mang `data` — tour nào đã mất, để form gỡ đúng tour ấy (vòng review
        // P4e-4). Các mã còn lại đi cổng chung như mọi controller.
        if (error instanceof RelatedTourNotFoundError) {
          throw errors.RELATED_TOUR_NOT_FOUND({ data: { tourIds: [...error.tourIds] } });
        }
        throw toContractError(error, errors);
      }
    });
  }

  @Implement(contract.admin.posts.delete)
  delete() {
    return implement(contract.admin.posts.delete).handler(async ({ input, errors }) => {
      try {
        return await this.posts.delete(input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }

  @Implement(contract.admin.posts.signCoverUpload)
  signCoverUpload() {
    return implement(contract.admin.posts.signCoverUpload).handler(async ({ input, errors }) => {
      try {
        return await this.posts.signCoverUpload(input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }

  @Implement(contract.admin.posts.tags)
  tags() {
    return implement(contract.admin.posts.tags).handler(() => this.posts.tags());
  }
}
