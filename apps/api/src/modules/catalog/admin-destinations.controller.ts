import { Controller } from '@nestjs/common';
import { implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import { AdminImplement } from '../../auth/admin-implement.decorator.js';
import { Roles } from '../../auth/roles.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { toContractError } from '../../lib/contract-error.js';
import { AdminDestinationsService } from './admin-destinations.service.js';

/**
 * Bề mặt điểm đến cho admin (spec P4e-2 F15). Cùng cách ghép guard như
 * `AdminCategoriesController`: `@Roles(ADMIN)` cấp class là lưới; quyền thật của từng handler do
 * `@AdminImplement` suy từ bảng `ADMIN_ACCESS` (ADR-0052) — ẩn danh → 401, khách → 403,
 * Staff → 403 ở thủ tục chỉ Owner, cả hai TRƯỚC khi oRPC parse input.
 *
 * Lỗi service → lỗi contract đi qua `toContractError` dùng chung (nợ G3): lỗi
 * của vùng này mang sẵn mã, nên không có nhánh `instanceof` riêng nào ở đây.
 */
@Controller()
@Roles(UserRole.ADMIN)
export class AdminDestinationsController {
  constructor(private readonly destinations: AdminDestinationsService) {}

  @AdminImplement(contract.admin.destinations.list)
  list() {
    return implement(contract.admin.destinations.list).handler(() => this.destinations.list());
  }

  @AdminImplement(contract.admin.destinations.create)
  create() {
    return implement(contract.admin.destinations.create).handler(async ({ input, errors }) => {
      try {
        return await this.destinations.create(input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }

  @AdminImplement(contract.admin.destinations.update)
  update() {
    return implement(contract.admin.destinations.update).handler(async ({ input, errors }) => {
      try {
        return await this.destinations.update(input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }

  @AdminImplement(contract.admin.destinations.setActive)
  setActive() {
    return implement(contract.admin.destinations.setActive).handler(async ({ input, errors }) => {
      try {
        return await this.destinations.setActive(input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }

  @AdminImplement(contract.admin.destinations.delete)
  delete() {
    return implement(contract.admin.destinations.delete).handler(async ({ input, errors }) => {
      try {
        return await this.destinations.delete(input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }

  @AdminImplement(contract.admin.destinations.photos)
  photos() {
    return implement(contract.admin.destinations.photos).handler(async ({ input, errors }) => {
      try {
        return await this.destinations.photos(input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }

  @AdminImplement(contract.admin.destinations.setPhotos)
  setPhotos() {
    return implement(contract.admin.destinations.setPhotos).handler(async ({ input, errors }) => {
      try {
        return await this.destinations.setPhotos(input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }

  @AdminImplement(contract.admin.destinations.signPhotoUploads)
  signPhotoUploads() {
    return implement(contract.admin.destinations.signPhotoUploads).handler(
      async ({ input, errors }) => {
        try {
          return await this.destinations.signPhotoUploads(input);
        } catch (error) {
          throw toContractError(error, errors);
        }
      },
    );
  }
}
