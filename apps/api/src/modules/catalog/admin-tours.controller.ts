import { Controller } from '@nestjs/common';
import { Implement, implement } from '@orpc/nest';
import { contract } from '@tourism/contract';
import { Roles } from '../../auth/roles.decorator.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { AdminCatalogService, TourNotFoundError } from './admin-catalog.service.js';

/**
 * Bề mặt tour cho admin (spec P4e-1 §3-F11). Cùng cách ghép guard như
 * `AdminReviewsController`: ẩn danh → 401, không phải admin → 403, cả hai
 * trước khi oRPC parse bất kỳ input nào.
 *
 * Controller RIÊNG chứ không đắp vào `CatalogController`: cái kia gắn
 * `@Public()` + `PublicCacheInterceptor` ở cấp class (mọi route trong đó là
 * đọc công khai cache được). Một route admin sống trong class ấy sẽ hoặc bị
 * cache công khai — rò danh sách tour nháp qua proxy — hoặc phải khai hai
 * decorator huỷ bỏ, và cái class đó sẽ mặc định SAI cho mọi route thêm sau.
 *
 * Trần ghi mặc định của ADR-0037 tự áp cho `setPublished` (route ghi có
 * session admin → `ADMIN_WRITE_THROTTLE`), không phải khai gì.
 */
@Controller()
@Roles(UserRole.ADMIN)
export class AdminToursController {
  constructor(private readonly adminCatalog: AdminCatalogService) {}

  @Implement(contract.admin.tours.list)
  list() {
    return implement(contract.admin.tours.list).handler(({ input }) =>
      this.adminCatalog.listTours(input),
    );
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
