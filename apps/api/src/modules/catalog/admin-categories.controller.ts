import { Controller } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import { Roles } from '../../auth/roles.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import {
  AdminCategoriesService,
  CannotMoveError,
  CategoryNotFoundError,
  SlugTakenError,
} from './admin-categories.service.js';

/**
 * Bề mặt danh mục tour cho admin (spec P4e-2 F14). Cùng cách ghép guard như
 * `AdminDeparturesController`: `@Roles(ADMIN)` ở cấp class được AuthGuard đọc —
 * ẩn danh → 401, không phải admin → 403, cả hai TRƯỚC khi oRPC parse input.
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
        throw mapError(error, errors);
      }
    });
  }

  @Implement(contract.admin.categories.update)
  update() {
    return implement(contract.admin.categories.update).handler(async ({ input, errors }) => {
      try {
        return await this.categories.update(input);
      } catch (error) {
        throw mapError(error, errors);
      }
    });
  }

  @Implement(contract.admin.categories.setActive)
  setActive() {
    return implement(contract.admin.categories.setActive).handler(async ({ input, errors }) => {
      try {
        return await this.categories.setActive(input);
      } catch (error) {
        throw mapError(error, errors);
      }
    });
  }

  @Implement(contract.admin.categories.move)
  move() {
    return implement(contract.admin.categories.move).handler(async ({ input, errors }) => {
      try {
        return await this.categories.move(input);
      } catch (error) {
        throw mapError(error, errors);
      }
    });
  }
}

/**
 * Lỗi của service → lỗi contract, giữ nguyên câu đã mang con số thật.
 *
 * `instanceof` chứ KHÔNG so `error.name` — bài học vòng hai F12: repo có năm
 * lớp cùng tên `TourNotFoundError` ở năm module, nên so theo tên là bắt nhầm
 * lỗi của bất kỳ module nào lọt vào đây.
 *
 * `errors` khai theo TỪNG procedure nên kiểu của nó hẹp hơn tập mã chung; một
 * mã lọt sang procedure không khai nó rơi về `throw error` (500 nhìn thấy
 * được) thay vì biến thành một lỗi im lặng sai loại.
 */
function mapError(error: unknown, errors: Record<string, (init?: { message: string }) => Error>) {
  if (error instanceof CategoryNotFoundError) {
    const notFound = errors.NOT_FOUND;
    if (notFound) return notFound();
  }
  if (error instanceof SlugTakenError) {
    const taken = errors.SLUG_TAKEN;
    if (taken) return taken({ message: error.message });
  }
  if (error instanceof CannotMoveError) {
    const cannot = errors.CANNOT_MOVE;
    if (cannot) return cannot({ message: error.message });
  }
  return error;
}
