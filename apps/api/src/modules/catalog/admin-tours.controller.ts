import { Controller } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import { Roles } from '../../auth/roles.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { toContractError } from '../../lib/contract-error.js';
import { AdminCatalogService, TourNotFoundError } from './admin-catalog.service.js';
import { AdminToursService } from './admin-tours.service.js';

/**
 * Bề mặt tour cho admin: danh sách vận hành cộng công tắc đăng (spec P4e-1
 * §3-F11), và khu làm việc của từng tour — đọc, tạo, sửa theo tab, xoá (spec
 * F17). Cùng cách ghép guard như `AdminReviewsController`: ẩn danh → 401, không
 * phải admin → 403, cả hai trước khi oRPC parse bất kỳ input nào.
 *
 * Controller RIÊNG chứ không đắp vào `CatalogController`: cái kia gắn
 * `@Public()` + `PublicCacheInterceptor` ở cấp class (mọi route trong đó là
 * đọc công khai cache được). Một route admin sống trong class ấy sẽ hoặc bị
 * cache công khai — rò danh sách tour nháp qua proxy — hoặc phải khai hai
 * decorator huỷ bỏ, và cái class đó sẽ mặc định SAI cho mọi route thêm sau.
 *
 * Lỗi của khu làm việc đổi sang lỗi contract bằng `toContractError` dùng chung
 * — chỉ mã mà procedure KHAI mới đi qua.
 *
 * Trần ghi mặc định của ADR-0037 tự áp cho mọi route ghi ở đây (route ghi có
 * session admin → `ADMIN_WRITE_THROTTLE`), không phải khai gì.
 */
@Controller()
@Roles(UserRole.ADMIN)
export class AdminToursController {
  constructor(
    private readonly adminCatalog: AdminCatalogService,
    private readonly adminTours: AdminToursService,
  ) {}

  @Implement(contract.admin.tours.list)
  list() {
    return implement(contract.admin.tours.list).handler(({ input }) =>
      this.adminCatalog.listTours(input),
    );
  }

  @Implement(contract.admin.tours.get)
  get() {
    return implement(contract.admin.tours.get).handler(async ({ input, errors }) => {
      try {
        return await this.adminTours.get(input.slug);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }

  @Implement(contract.admin.tours.create)
  create() {
    return implement(contract.admin.tours.create).handler(async ({ input, errors }) => {
      try {
        return await this.adminTours.create(input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }

  @Implement(contract.admin.tours.delete)
  delete() {
    return implement(contract.admin.tours.delete).handler(async ({ input, errors }) => {
      try {
        return await this.adminTours.delete(input);
      } catch (error) {
        throw toContractError(error, errors);
      }
    });
  }

  @Implement(contract.admin.tours.setPublished)
  setPublished() {
    return implement(contract.admin.tours.setPublished).handler(async ({ input, errors }) => {
      try {
        return await this.adminCatalog.setTourPublished(input);
      } catch (err) {
        if (err instanceof TourNotFoundError) throw errors.NOT_FOUND();
        throw err;
      }
    });
  }
}
