import { SetMetadata } from '@nestjs/common';
import type { UserRole } from '../generated/prisma/enums.js';

export const ROLES_KEY = 'auth:roles';

/** Yêu cầu role cụ thể (AuthGuard kiểm tra, 403 nếu thiếu). Vd: `@Roles('ADMIN')`. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
