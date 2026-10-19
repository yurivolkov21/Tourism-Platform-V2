import { UseInterceptors } from '@nestjs/common';
import { Implement } from '@orpc/nest';
import { ADMIN_ACCESS, adminProcedureKey, isLoggedProcedure } from '@tourism/contract';
import { UserRole } from '../generated/prisma/enums.js';
import { AdminActivityInterceptor } from '../modules/activity/admin-activity.interceptor.js';
import { Roles } from './roles.decorator.js';

/**
 * Role được gọi một thủ tục admin, suy từ bảng quyền của contract (ADR-0052 §3):
 * `owner` → chỉ ADMIN (Owner), `staff` → ADMIN và STAFF.
 *
 * Thủ tục không thuộc `contract.admin` là lỗi lập trình: ném lúc NẠP module (decorator chạy
 * khi class được định nghĩa) để API không boot được, thay vì để handler ấy âm thầm rơi về
 * lưới `@Roles(ADMIN)` cấp class.
 */
export function adminRolesFor(procedure: unknown): UserRole[] {
  const key = adminProcedureKey(procedure);
  if (!key) throw new Error('AdminImplement chỉ nhận thủ tục thuộc contract.admin');
  return ADMIN_ACCESS[key] === 'staff' ? [UserRole.ADMIN, UserRole.STAFF] : [UserRole.ADMIN];
}

type ImplementDecorator = ReturnType<typeof Implement>;

/**
 * Thay `@Implement(contract.admin.…)` ở MỌI handler admin: gắn route của contract như cũ,
 * cộng `@Roles(...)` lấy từ bảng quyền. Quyền vì vậy chỉ có một nguồn — không handler nào tự
 * khai `@Roles(ADMIN, STAFF)` bằng tay. Kiểu đã đo bằng tsc trên `@orpc/nest` 1.14.8.
 *
 * Thủ tục `log` của `ADMIN_ACTIVITY` gắn thêm interceptor nhật ký (ADR-0061 §3) SAU
 * `ImplementInterceptor` trong mảng metadata, tức nằm TRONG nó lúc chạy — không controller nào tự
 * gọi ghi nhật ký.
 */
export function AdminImplement(procedure: Parameters<typeof Implement>[0]): ImplementDecorator {
  const roles = adminRolesFor(procedure);
  // adminRolesFor đã ném khi thủ tục không thuộc contract.admin, nên khoá ở đây luôn có.
  const key = adminProcedureKey(procedure);
  const implement = Implement(procedure);
  const decorate: ImplementDecorator = (target, propertyKey, descriptor) => {
    implement(target, propertyKey, descriptor);
    Roles(...roles)(target, propertyKey, descriptor);
    if (key && isLoggedProcedure(key)) {
      UseInterceptors(new AdminActivityInterceptor(key))(target, propertyKey, descriptor);
    }
  };
  return decorate;
}
